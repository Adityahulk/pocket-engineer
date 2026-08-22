from __future__ import annotations

import asyncio
import hashlib
import json
import re
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .auth import authenticate_header
from .database import SessionLocal, create_schema, get_db
from .events import append_event
from .github import GitHubError, GitHubService
from .models import Project, Task, TaskEvent
from .runner import TaskRunner
from .schemas import (
    ApprovalDecision,
    AuthConfigRead,
    CommandCenterRead,
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
)

settings = get_settings()
runner = TaskRunner(settings)


def seed_demo() -> None:
    if not settings.demo_enabled:
        return
    demo_path = settings.resolve_from_api(settings.demo_repository_path)
    with SessionLocal() as session:
        existing = session.scalar(select(Project).where(Project.is_demo.is_(True)))
        if existing:
            existing.local_path = str(demo_path)
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
    if request.url.path.startswith("/v1/") and request.url.path != "/v1/auth/config":
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
    return AuthConfigRead(required=settings.auth_mode != "disabled", provider=settings.auth_mode)


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
    )


@app.post("/v1/voice/client-secret")
async def create_voice_client_secret(payload: VoiceSessionCreate, session: Session = Depends(get_db)):
    if not settings.openai_api_key:
        raise HTTPException(503, "Realtime voice is not configured. Set POCKET_OPENAI_API_KEY on the API server.")
    project = session.get(Project, payload.project_id) if payload.project_id else None
    mission = session.get(Task, payload.mission_id) if payload.mission_id else None
    if payload.project_id and not project:
        raise HTTPException(404, "Project not found")
    if payload.mission_id and not mission:
        raise HTTPException(404, "Mission not found")

    context_lines = ["You are on a live phone call inside Pocket Engineer Mission Control."]
    if project:
        context_lines.append(
            f"Current software: {project.name}. Health: {project.health_status}. Status summary: {project.health_summary}."
        )
    if mission:
        context_lines.append(
            f"Current mission: {mission.goal}. Mission state: {mission.state}. "
            f"Verified summary: {mission.summary or 'No verified result yet.'}"
        )
    instructions = " ".join(context_lines) + " " + (
        "Act like a calm, experienced senior software engineer speaking with a teammate on the phone. "
        "Be warm, direct, and concise. Acknowledge what you heard before proposing a solution. Ask one question at a time. "
        "Keep spoken turns short and stop immediately when interrupted. Do not read raw code, diffs, hashes, or logs aloud unless asked. "
        "Never claim that code changed, tests passed, a PR exists, or production changed unless the mission context explicitly says so. "
        "When the user wants engineering work performed, clarify the outcome and then call draft_mission. "
        "Tell the user you have put the mission on screen for review. Never say it has started until the user taps Start Mission. "
        "Any Git write, merge, deployment, rollback, secret access, or destructive action requires visible confirmation in the app."
    )
    session_payload = {
        "session": {
            "type": "realtime",
            "model": settings.realtime_model,
            "instructions": instructions,
            "audio": {
                "input": {
                    "transcription": {"model": "gpt-4o-mini-transcribe"},
                    "turn_detection": {"type": "semantic_vad"},
                },
                "output": {"voice": settings.realtime_voice},
            },
            "tools": [
                {
                    "type": "function",
                    "name": "draft_mission",
                    "description": "Draft, but do not start, an engineering mission for visible user confirmation.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "goal": {"type": "string", "description": "Outcome the engineer should achieve."},
                            "mode": {"type": "string", "enum": ["fix", "modify"]},
                            "priority": {"type": "string", "enum": ["normal", "high", "urgent"]},
                        },
                        "required": ["goal", "mode"],
                        "additionalProperties": False,
                    },
                }
            ],
            "tool_choice": "auto",
        }
    }
    safety_subject = hashlib.sha256((payload.project_id or "portfolio-call").encode()).hexdigest()[:32]
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


@app.get("/v1/command-center", response_model=CommandCenterRead)
def command_center(session: Session = Depends(get_db)):
    projects = list(session.scalars(select(Project).order_by(Project.created_at.desc())).all())
    active_states = {"queued", "provisioning", "investigating", "planning", "implementing", "verifying"}
    active = list(session.scalars(select(Task).where(Task.state.in_(active_states)).order_by(Task.updated_at.desc())).all())
    approvals = session.scalars(select(Task).where(Task.state == "ready_for_review")).all()
    engineers = [
        EngineerRead(
            id=f"engineer-{task.id}",
            name=task.engineer_name,
            specialty="Production reliability" if task.mode == "fix" else "Product engineering",
            status=task.state,
            current_mission_id=task.id,
            project_id=task.project_id,
        )
        for task in active[:4]
    ]
    if not engineers:
        engineers.append(
            EngineerRead(id="engineer-on-call", name="On-call Engineer", specialty="Incidents and reliability", status="available")
        )
    incident_count = sum(project.incident_count for project in projects)
    return CommandCenterRead(
        portfolio_health="incident" if incident_count else "healthy",
        active_missions=len(active),
        approval_count=len(list(approvals)),
        incident_count=incident_count,
        projects=[ProjectRead.model_validate(project) for project in projects],
        engineers=engineers,
    )


@app.get(
    "/v1/github/installations/{installation_id}/repositories",
    response_model=list[GitHubRepositoryRead],
)
async def github_repositories(installation_id: int):
    try:
        return await GitHubService(settings).list_installation_repositories(installation_id)
    except GitHubError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.get("/v1/projects", response_model=list[ProjectRead])
def list_projects(session: Session = Depends(get_db)):
    return session.scalars(select(Project).order_by(Project.created_at.desc())).all()


@app.post("/v1/projects", response_model=ProjectRead, status_code=201)
def create_project(payload: ProjectCreate, session: Session = Depends(get_db)):
    project = Project(**payload.model_dump(), provider="github", status="ready")
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@app.get("/v1/projects/{project_id}", response_model=ProjectRead)
def get_project(project_id: str, session: Session = Depends(get_db)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@app.get("/v1/projects/{project_id}/tasks", response_model=list[TaskRead])
def list_project_tasks(project_id: str, session: Session = Depends(get_db)):
    if not session.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    return session.scalars(
        select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())
    ).all()


@app.post("/v1/projects/{project_id}/tasks", response_model=TaskRead, status_code=202)
def create_task(project_id: str, payload: TaskCreate, session: Session = Depends(get_db)):
    if not session.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    task = Task(project_id=project_id, goal=payload.goal, mode=payload.mode, state="queued")
    session.add(task)
    session.commit()
    append_event(session, task, "task.created", "Mission accepted and queued", {"mode": payload.mode})
    session.refresh(task)
    return task


@app.get("/v1/tasks/{task_id}", response_model=TaskRead)
def get_task(task_id: str, session: Session = Depends(get_db)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@app.get("/v1/tasks/{task_id}/events", response_model=list[TaskEventRead])
def get_task_events(
    task_id: str,
    after: int = Query(default=0, ge=0),
    session: Session = Depends(get_db),
):
    if not session.get(Task, task_id):
        raise HTTPException(404, "Task not found")
    return session.scalars(
        select(TaskEvent)
        .where(TaskEvent.task_id == task_id, TaskEvent.sequence > after)
        .order_by(TaskEvent.sequence)
    ).all()


@app.get("/v1/tasks/{task_id}/events/stream")
async def stream_task_events(task_id: str, after: int = Query(default=0, ge=0)):
    with SessionLocal() as session:
        if not session.get(Task, task_id):
            raise HTTPException(404, "Task not found")

    async def stream():
        cursor = after
        idle_ticks = 0
        while idle_ticks < 600:
            with SessionLocal() as session:
                events = session.scalars(
                    select(TaskEvent)
                    .where(TaskEvent.task_id == task_id, TaskEvent.sequence > cursor)
                    .order_by(TaskEvent.sequence)
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
def decide_approval(task_id: str, payload: ApprovalDecision, session: Session = Depends(get_db)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.state != "ready_for_review":
        raise HTTPException(409, "Task is not ready for approval")
    task.approval_status = payload.decision
    if payload.decision == "rejected":
        task.state = "cancelled"
    session.commit()
    append_event(
        session,
        task,
        "task.approval_resolved",
        f"Pull request creation {payload.decision}",
        {"decision": payload.decision},
    )
    session.refresh(task)
    return task


@app.post("/v1/tasks/{task_id}/pull-request", response_model=TaskRead)
async def create_pull_request(task_id: str, session: Session = Depends(get_db)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.state == "completed" and task.pull_request_url:
        return task
    if task.state != "ready_for_review" or task.approval_status != "approved":
        raise HTTPException(409, "Approved review is required before creating a pull request")
    project = task.project
    if project.is_demo:
        task.pull_request_url = f"{settings.public_base_url}/demo/pull/{task.id}"
        task.state = "completed"
        session.commit()
        append_event(session, task, "pull_request.created", "Demo pull request created", {"url": task.pull_request_url})
        session.refresh(task)
        return task

    github = GitHubService(settings)
    token = await github.installation_token(project.github_installation_id)
    if not token:
        raise HTTPException(503, "GitHub App credentials are not configured")
    if not project.repo_full_name or not task.diff or not task.base_sha:
        raise HTTPException(409, "Repository or reviewed patch metadata is incomplete")
    slug = re.sub(r"[^a-z0-9]+", "-", task.goal.lower()).strip("-")[:36]
    branch = f"pocket/{task.id[:8]}-{slug or 'change'}"
    try:
        await asyncio.to_thread(
            runner.repositories.publish_patch,
            project,
            task.id,
            task.base_sha,
            task.diff,
            token,
            branch,
            f"fix: {task.goal[:65]}",
        )
        checks = "\n".join(
            f"- {'✅' if item['status'] == 'passed' else '⚠️'} {item['name']}: {item['status']}"
            for item in task.verification
        )
        task.pull_request_url = await github.create_pull_request(
            project.repo_full_name,
            token,
            branch,
            project.default_branch,
            f"Pocket Engineer: {task.goal[:80]}",
            f"## Outcome\n\n{task.summary}\n\n## Root cause\n\n{task.root_cause}\n\n## Verification\n\n{checks}",
        )
    except (GitHubError, RuntimeError) as exc:
        raise HTTPException(502, str(exc)) from exc
    task.state = "completed"
    session.commit()
    append_event(session, task, "pull_request.created", "GitHub pull request created", {"url": task.pull_request_url})
    session.refresh(task)
    return task


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
def cancel_task(task_id: str, session: Session = Depends(get_db)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.state in {"completed", "failed", "cancelled"}:
        return task
    task.state = "cancelled"
    session.commit()
    append_event(session, task, "task.cancelled", "Mission cancelled by the user")
    session.refresh(task)
    return task
