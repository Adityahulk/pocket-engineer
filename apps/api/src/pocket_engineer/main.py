from __future__ import annotations

import asyncio
import hashlib
import json
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .access import bind_installation, current_user, get_project, get_task, visible_projects
from .auth import AuthenticatedUser, authenticate_header
from .config import get_settings
from .database import SessionLocal, create_schema, get_db
from .events import append_event
from .github import GitHubError, GitHubService
from .models import Project, Task, TaskEvent
from .notify import register_device
from .rate_limit import limiter
from .runner import TaskRunner
from .schemas import (
    AlertIngest,
    ApprovalDecision,
    AuthConfigRead,
    CommandCenterRead,
    DeviceRegister,
    EngineerRead,
    GitHubConfigRead,
    GitHubRepositoryRead,
    ProjectCreate,
    ProjectRead,
    TaskCreate,
    TaskEventRead,
    TaskRead,
    VoiceConfigRead,
    VoiceSessionCreate,
    VoiceToolCall,
)
from .shipping import ShipError, ship_task
from .signals import apply_alert, apply_github_event
from .voice_session import VOICE_TOOLS, voice_instructions
from .voice_tools import ACTIVE, execute_voice_tool
from .webapp import mount_web_app, web_dist

settings = get_settings()
runner = TaskRunner(settings)
PUBLIC_PATHS = {
    "/health",
    "/health/ready",
    "/v1/auth/config",
    "/v1/github/webhooks",
    "/v1/ingest/alerts",
}


def seed_demo() -> None:
    if not settings.demo_enabled:
        return
    demo_path = settings.resolve_from_api(settings.demo_repository_path)
    with SessionLocal() as session:
        existing = session.scalar(select(Project).where(Project.is_demo.is_(True)))
        if existing:
            existing.local_path = str(demo_path)
            existing.health_status = "incident"
            existing.health_summary = "Demo fixture: checkout 500s for customers without a discount."
            existing.incident_count = 1
            session.commit()
            return
        session.add(
            Project(
                name="Checkout API Demo",
                provider="local",
                repo_url="local://demo-checkout",
                local_path=str(demo_path),
                default_branch="main",
                status="ready",
                is_demo=True,
                owner_user_id=None,
                health_status="incident",
                health_summary="Demo fixture: checkout 500s for customers without a discount.",
                incident_count=1,
            )
        )
        session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_schema()
    seed_demo()
    worker_task = asyncio.create_task(runner.worker_loop()) if settings.worker_enabled else None
    yield
    runner.stop()
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Pocket Engineer API",
    version="0.1.0",
    description="Mobile control plane for verified repository engineering tasks.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def authenticate_api(request: Request, call_next):
    path = request.url.path
    if path.startswith("/v1/") and path not in PUBLIC_PATHS:
        try:
            request.state.user = await authenticate_header(request.headers.get("authorization"), settings)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return await call_next(request)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "environment": settings.environment, "agent_provider": settings.agent_provider}


@app.get("/health/ready")
def readiness(session: Session = Depends(get_db)) -> dict:
    try:
        session.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(503, "Database is not ready") from exc
    return {"status": "ready"}


@app.get("/v1/auth/config", response_model=AuthConfigRead)
def auth_config() -> AuthConfigRead:
    return AuthConfigRead(
        required=settings.auth_mode != "disabled",
        provider=settings.auth_mode,
        supabase_url=settings.supabase_url,
        supabase_publishable_key=settings.public_supabase_publishable_key,
    )


@app.get("/v1/github/config", response_model=GitHubConfigRead)
def github_config() -> GitHubConfigRead:
    url = GitHubService(settings).installation_url
    return GitHubConfigRead(enabled=bool(url), installation_url=url)


@app.get("/v1/voice/config", response_model=VoiceConfigRead)
def voice_config() -> VoiceConfigRead:
    return VoiceConfigRead(
        enabled=bool(settings.openai_api_key),
        provider="openai-realtime",
        model=settings.realtime_model,
        voice=settings.realtime_voice,
        engineer_name=settings.engineer_name,
        engineer_title=settings.engineer_title,
    )


@app.post("/v1/devices")
def register_push_device(payload: DeviceRegister, request: Request, session: Session = Depends(get_db)):
    user = current_user(request)
    device = register_device(session, user.id, payload.expo_push_token, payload.platform)
    return {"id": device.id}


@app.post("/v1/voice/client-secret")
async def create_voice_client_secret(payload: VoiceSessionCreate, request: Request, session: Session = Depends(get_db)):
    user = current_user(request)
    limiter.check(f"voice:{user.id}", 8, 60)
    if not settings.openai_api_key:
        raise HTTPException(503, "Realtime voice is not configured. Set POCKET_OPENAI_API_KEY on the API server.")
    project = get_project(session, payload.project_id, user, settings) if payload.project_id else None
    mission = get_task(session, payload.mission_id, user, settings) if payload.mission_id else None
    status = execute_voice_tool(session, user, settings, "get_status", {}, payload.project_id, payload.mission_id)
    portfolio = (
        f"Portfolio health: {status['incident_count']} incident(s), "
        f"{len(status['active_missions'])} active missions, {len(status['pending_decisions'])} decisions."
    )
    session_payload = {
        "session": {
            "type": "realtime",
            "model": settings.realtime_model,
            "instructions": voice_instructions(settings, project, mission, portfolio),
            "audio": {
                "input": {
                    "transcription": {"model": "gpt-4o-mini-transcribe"},
                    "turn_detection": {"type": "semantic_vad"},
                },
                "output": {"voice": settings.realtime_voice},
            },
            "tools": VOICE_TOOLS,
            "tool_choice": "auto",
        }
    }
    safety_subject = hashlib.sha256((user.id + (payload.project_id or "portfolio-call")).encode()).hexdigest()[:32]
    async with httpx.AsyncClient(base_url=settings.realtime_api_url, timeout=30) as client:
        response = await client.post(
            "/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
                "OpenAI-Safety-Identifier": safety_subject,
            },
            json=session_payload,
        )
    if response.is_error:
        raise HTTPException(502, f"Voice provider session failed: {response.status_code} {response.text[:500]}")
    return response.json()


@app.post("/v1/voice/tools")
def voice_tool(payload: VoiceToolCall, request: Request, session: Session = Depends(get_db)):
    user = current_user(request)
    limiter.check(f"tools:{user.id}", 30, 60)
    return execute_voice_tool(session, user, settings, payload.name, payload.arguments, payload.project_id, payload.mission_id)


@app.get("/v1/command-center", response_model=CommandCenterRead)
def command_center(request: Request, session: Session = Depends(get_db)):
    user = current_user(request)
    projects = visible_projects(session, user, settings)
    owned_ids = {project.id for project in projects}
    active = [
        task
        for task in session.scalars(select(Task).where(Task.state.in_(ACTIVE)).order_by(Task.updated_at.desc())).all()
        if task.project_id in owned_ids
    ]
    approvals = [
        task
        for task in session.scalars(select(Task).where(Task.state == "ready_for_review").order_by(Task.updated_at.desc())).all()
        if task.project_id in owned_ids
    ]
    engineers = [
        EngineerRead(
            id=f"engineer-{task.id}",
            name=task.engineer_name or settings.engineer_name,
            specialty=settings.engineer_title,
            status=task.state,
            current_mission_id=task.id,
            project_id=task.project_id,
        )
        for task in active[:4]
    ]
    if not engineers:
        engineers.append(
            EngineerRead(
                id="engineer-on-call",
                name=settings.engineer_name,
                specialty=settings.engineer_title,
                status="available",
            )
        )
    incident_count = sum(project.incident_count for project in projects)
    return CommandCenterRead(
        portfolio_health="incident" if incident_count else "healthy",
        active_missions=len(active),
        approval_count=len(approvals),
        incident_count=incident_count,
        engineer_name=settings.engineer_name,
        engineer_title=settings.engineer_title,
        projects=[ProjectRead.model_validate(project) for project in projects],
        engineers=engineers,
        pending_decisions=[TaskRead.model_validate(task) for task in approvals],
        active_mission_list=[TaskRead.model_validate(task) for task in active],
    )


@app.get("/v1/decisions", response_model=list[TaskRead])
def list_decisions(request: Request, session: Session = Depends(get_db)):
    return command_center(request, session).pending_decisions


@app.get("/v1/missions", response_model=list[TaskRead])
def list_missions(request: Request, session: Session = Depends(get_db)):
    return command_center(request, session).active_mission_list


@app.get("/v1/github/installations/{installation_id}/repositories", response_model=list[GitHubRepositoryRead])
async def github_repositories(installation_id: int, request: Request, session: Session = Depends(get_db)):
    user = current_user(request)
    bind_installation(session, user, installation_id, settings)
    try:
        return await GitHubService(settings).list_installation_repositories(installation_id)
    except GitHubError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.post("/v1/github/webhooks")
async def github_webhook(request: Request, session: Session = Depends(get_db)):
    body = await request.body()
    try:
        GitHubService(settings).verify_webhook(body, request.headers.get("x-hub-signature-256"))
    except GitHubError as exc:
        raise HTTPException(401, str(exc)) from exc
    event = request.headers.get("x-github-event", "")
    payload = json.loads(body.decode() or "{}")
    apply_github_event(session, event, payload)
    return {"ok": True}


@app.post("/v1/ingest/alerts", response_model=ProjectRead)
def ingest_alert(payload: AlertIngest, request: Request, session: Session = Depends(get_db)):
    token = settings.alert_webhook_token
    provided = request.headers.get("x-pocket-token") or request.query_params.get("token")
    user = getattr(request.state, "user", None)
    if token:
        if provided != token:
            raise HTTPException(401, "Invalid alert webhook token")
    elif not isinstance(user, AuthenticatedUser):
        raise HTTPException(401, "Alert webhook token or signed-in user is required")
    try:
        project = apply_alert(session, payload, user if isinstance(user, AuthenticatedUser) else None, settings)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(404, str(exc)) from exc
    return project


@app.get("/v1/projects", response_model=list[ProjectRead])
def list_projects(request: Request, session: Session = Depends(get_db)):
    return visible_projects(session, current_user(request), settings)


@app.post("/v1/projects", response_model=ProjectRead, status_code=201)
def create_project(payload: ProjectCreate, request: Request, session: Session = Depends(get_db)):
    user = current_user(request)
    if payload.github_installation_id:
        bind_installation(session, user, payload.github_installation_id, settings)
    project = Project(
        **payload.model_dump(),
        provider="github",
        status="ready",
        owner_user_id=user.id,
        health_status="healthy",
        health_summary="No live alerts yet. Health updates from GitHub checks and inbound alert webhooks.",
        incident_count=0,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@app.get("/v1/projects/{project_id}", response_model=ProjectRead)
def read_project(project_id: str, request: Request, session: Session = Depends(get_db)):
    return get_project(session, project_id, current_user(request), settings)


@app.get("/v1/projects/{project_id}/tasks", response_model=list[TaskRead])
def list_project_tasks(project_id: str, request: Request, session: Session = Depends(get_db)):
    get_project(session, project_id, current_user(request), settings)
    return session.scalars(select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())).all()


@app.post("/v1/projects/{project_id}/tasks", response_model=TaskRead, status_code=202)
def create_task(project_id: str, payload: TaskCreate, request: Request, session: Session = Depends(get_db)):
    user = current_user(request)
    limiter.check(f"tasks:{user.id}", 20, 60)
    get_project(session, project_id, user, settings)
    task = Task(
        project_id=project_id,
        owner_user_id=user.id,
        goal=payload.goal,
        mode=payload.mode,
        priority=payload.priority,
        autonomy=payload.autonomy,
        state="queued",
        engineer_name=settings.engineer_name,
        engineer_provider="Pocket Engineer",
    )
    session.add(task)
    session.commit()
    append_event(session, task, "task.created", "Mission accepted and queued", {"mode": payload.mode, "autonomy": payload.autonomy})
    session.refresh(task)
    return task


@app.get("/v1/tasks/{task_id}", response_model=TaskRead)
def read_task(task_id: str, request: Request, session: Session = Depends(get_db)):
    return get_task(session, task_id, current_user(request), settings)


@app.get("/v1/tasks/{task_id}/events", response_model=list[TaskEventRead])
def get_task_events(task_id: str, request: Request, after: int = Query(default=0, ge=0), session: Session = Depends(get_db)):
    get_task(session, task_id, current_user(request), settings)
    return session.scalars(
        select(TaskEvent).where(TaskEvent.task_id == task_id, TaskEvent.sequence > after).order_by(TaskEvent.sequence)
    ).all()


@app.get("/v1/tasks/{task_id}/events/stream")
async def stream_task_events(task_id: str, request: Request, after: int = Query(default=0, ge=0)):
    with SessionLocal() as session:
        get_task(session, task_id, current_user(request), settings)

    async def stream():
        cursor = after
        idle_ticks = 0
        while idle_ticks < 600:
            with SessionLocal() as session:
                events = session.scalars(
                    select(TaskEvent).where(TaskEvent.task_id == task_id, TaskEvent.sequence > cursor).order_by(TaskEvent.sequence)
                ).all()
                task = session.get(Task, task_id)
                for event in events:
                    cursor = event.sequence
                    payload = TaskEventRead.model_validate(event).model_dump(mode="json")
                    yield f"id: {event.sequence}\nevent: {event.event_type}\ndata: {json.dumps(payload)}\n\n"
                if events:
                    idle_ticks = 0
                else:
                    idle_ticks += 1
                    yield ": keep-alive\n\n"
                if task and task.state in {"ready_for_review", "completed", "failed", "cancelled"} and not events:
                    break
            await asyncio.sleep(1)

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/v1/tasks/{task_id}/approval", response_model=TaskRead)
def decide_approval(task_id: str, payload: ApprovalDecision, request: Request, session: Session = Depends(get_db)):
    task = get_task(session, task_id, current_user(request), settings)
    if task.state != "ready_for_review":
        raise HTTPException(409, "Task is not ready for approval")
    task.approval_status = payload.decision
    task.feedback = payload.feedback
    if payload.decision == "rejected":
        task.state = "cancelled"
    session.commit()
    append_event(
        session,
        task,
        "task.approval_resolved",
        f"Pull request creation {payload.decision}",
        {"decision": payload.decision, "feedback": payload.feedback},
    )
    session.refresh(task)
    return task


@app.post("/v1/tasks/{task_id}/pull-request", response_model=TaskRead)
def create_pull_request(task_id: str, request: Request, session: Session = Depends(get_db)):
    task = get_task(session, task_id, current_user(request), settings)
    try:
        return ship_task(session, task, settings)
    except ShipError as exc:
        message = str(exc)
        status = 409 if any(token in message.lower() for token in ("not ready", "incomplete", "approved review")) else 502
        raise HTTPException(status, message) from exc


@app.post("/v1/tasks/{task_id}/ship", response_model=TaskRead)
def ship(task_id: str, request: Request, session: Session = Depends(get_db)):
    return create_pull_request(task_id, request, session)


@app.get("/demo/pull/{task_id}", response_class=HTMLResponse)
def demo_pull_request(task_id: str, session: Session = Depends(get_db)):
    task = session.get(Task, task_id)
    if not task or not task.project.is_demo or task.state != "completed":
        raise HTTPException(404, "Demo pull request not found")
    safe_title = task.goal.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe_summary = (task.summary or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!doctype html><html><head><meta name=viewport content='width=device-width'>
    <title>Demo PR · Pocket Engineer</title><style>
    body{{font:16px system-ui;background:#08111f;color:#f4f7f2;margin:0;padding:40px}}
    main{{max-width:720px;margin:auto}}small{{color:#8ef0c7;font-weight:800;letter-spacing:.12em}}
    h1{{font-size:34px;line-height:1.1}}section{{background:#101c2c;border:1px solid #26364a;border-radius:18px;padding:22px;margin-top:24px}}
    .ok{{color:#8ef0c7}}
    </style></head><body><main><small>DEMO PULL REQUEST · OPEN</small><h1>{safe_title}</h1>
    <section><small>OUTCOME</small><p>{safe_summary}</p><p class=ok>✓ All required checks passed</p></section>
    <p>This local page represents the GitHub PR handoff. Configure a GitHub App to create a real remote branch and PR.</p>
    </main></body></html>"""


@app.post("/v1/tasks/{task_id}/cancel", response_model=TaskRead)
def cancel_task(task_id: str, request: Request, session: Session = Depends(get_db)):
    task = get_task(session, task_id, current_user(request), settings)
    if task.state in {"completed", "failed", "cancelled"}:
        return task
    task.state = "cancelled"
    session.commit()
    append_event(session, task, "task.cancelled", "Mission cancelled by the user")
    session.refresh(task)
    return task


mount_web_app(app, web_dist(settings))
