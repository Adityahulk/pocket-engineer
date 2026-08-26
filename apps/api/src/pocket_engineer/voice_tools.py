from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .access import get_project, get_task, visible_projects
from .auth import AuthenticatedUser
from .config import Settings
from .events import append_event
from .models import Task
from .schemas import TaskRead
from .shipping import ShipError, ship_task


ACTIVE = {"queued", "provisioning", "investigating", "planning", "implementing", "verifying"}


def execute_voice_tool(
    session: Session,
    user: AuthenticatedUser,
    settings: Settings,
    name: str,
    arguments: dict,
    project_id: str | None,
    mission_id: str | None,
) -> dict:
    if name == "get_status":
        return _status(session, user, settings, arguments.get("project_id") or project_id, arguments.get("mission_id") or mission_id)
    if name == "start_mission":
        return _start(session, user, settings, arguments, project_id)
    if name == "ship_mission":
        return _ship(session, user, settings, arguments.get("mission_id") or mission_id)
    if name == "reject_mission":
        return _reject(session, user, settings, arguments.get("mission_id") or mission_id, arguments.get("feedback"))
    raise HTTPException(400, f"Unknown voice tool: {name}")


def _status(session: Session, user: AuthenticatedUser, settings: Settings, project_id: str | None, mission_id: str | None) -> dict:
    projects = visible_projects(session, user, settings)
    incidents = [project for project in projects if project.health_status == "incident"]
    active = list(session.scalars(select(Task).where(Task.state.in_(ACTIVE)).order_by(Task.updated_at.desc())).all())
    decisions = list(session.scalars(select(Task).where(Task.state == "ready_for_review")).all())
    if settings.auth_mode != "disabled":
        owned = {project.id for project in projects}
        active = [task for task in active if task.project_id in owned]
        decisions = [task for task in decisions if task.project_id in owned]
    payload = {
        "engineer": settings.engineer_label,
        "incident_count": sum(project.incident_count for project in projects),
        "incidents": [{"id": project.id, "name": project.name, "summary": project.health_summary} for project in incidents],
        "active_missions": [_brief(task) for task in active[:8]],
        "pending_decisions": [_brief(task) for task in decisions[:8]],
    }
    if project_id:
        project = get_project(session, project_id, user, settings)
        payload["project"] = {
            "id": project.id,
            "name": project.name,
            "is_demo": project.is_demo,
            "health_status": project.health_status,
            "health_summary": project.health_summary,
        }
    if mission_id:
        task = get_task(session, mission_id, user, settings)
        payload["mission"] = TaskRead.model_validate(task).model_dump(mode="json")
    return payload


def _start(session: Session, user: AuthenticatedUser, settings: Settings, arguments: dict, fallback_project_id: str | None) -> dict:
    project_id = arguments.get("project_id") or fallback_project_id
    if not project_id:
        raise HTTPException(400, "Choose software before starting a mission.")
    goal = str(arguments.get("goal") or "").strip()
    mode = arguments.get("mode") or "fix"
    if len(goal) < 3 or mode not in {"fix", "modify"}:
        raise HTTPException(400, "A goal and mode are required to start work.")
    project = get_project(session, project_id, user, settings)
    task = Task(
        project_id=project.id,
        owner_user_id=user.id,
        goal=goal,
        mode=mode,
        priority=arguments.get("priority") or "normal",
        autonomy=arguments.get("autonomy") or "assisted",
        state="queued",
        engineer_name=settings.engineer_name,
        engineer_provider="Pocket Engineer",
    )
    session.add(task)
    session.commit()
    append_event(session, task, "task.created", "Mission started from engineer call", {"mode": task.mode, "autonomy": task.autonomy})
    session.refresh(task)
    return {"started": True, "mission": TaskRead.model_validate(task).model_dump(mode="json")}


def _ship(session: Session, user: AuthenticatedUser, settings: Settings, mission_id: str | None) -> dict:
    if not mission_id:
        raise HTTPException(400, "No mission to ship.")
    task = get_task(session, mission_id, user, settings)
    try:
        shipped = ship_task(session, task, settings, approve=True)
    except ShipError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {"shipped": True, "mission": TaskRead.model_validate(shipped).model_dump(mode="json")}


def _reject(session: Session, user: AuthenticatedUser, settings: Settings, mission_id: str | None, feedback: str | None) -> dict:
    if not mission_id:
        raise HTTPException(400, "No mission to reject.")
    task = get_task(session, mission_id, user, settings)
    if task.state != "ready_for_review":
        raise HTTPException(409, "Task is not ready for approval")
    task.approval_status = "rejected"
    task.state = "cancelled"
    task.feedback = feedback
    session.commit()
    append_event(session, task, "task.approval_resolved", "Patch rejected", {"decision": "rejected", "feedback": feedback})
    session.refresh(task)
    return {"rejected": True, "mission": TaskRead.model_validate(task).model_dump(mode="json")}


def _brief(task: Task) -> dict:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "goal": task.goal,
        "state": task.state,
        "priority": task.priority,
        "autonomy": task.autonomy,
    }
