from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import AuthenticatedUser
from .config import Settings
from .models import Project, Task, utcnow
from .schemas import AlertIngest


def apply_alert(session: Session, alert: AlertIngest, user: AuthenticatedUser | None, settings: Settings) -> Project:
    project: Project | None = None
    if alert.project_id:
        project = session.get(Project, alert.project_id)
    elif alert.repo_full_name:
        project = session.scalar(select(Project).where(Project.repo_full_name == alert.repo_full_name))
    if not project:
        raise LookupError("No matching project for this alert")
    if user and settings.auth_mode != "disabled" and project.owner_user_id not in {None, user.id}:
        raise PermissionError("Project not found")

    project.last_signal_at = utcnow()
    if alert.resolved or alert.severity in {"info"}:
        project.health_status = "healthy"
        project.health_summary = alert.summary
        project.incident_count = 0
    else:
        project.health_status = "incident"
        project.health_summary = f"{alert.source}: {alert.summary}"
        project.incident_count = max(project.incident_count, 1)
    session.commit()
    session.refresh(project)
    return project


def apply_github_event(session: Session, event: str, payload: dict) -> None:
    if event in {"check_run", "check_suite", "workflow_run"}:
        repo = (payload.get("repository") or {}).get("full_name")
        project = session.scalar(select(Project).where(Project.repo_full_name == repo)) if repo else None
        if not project:
            return
        conclusion = (
            (payload.get("check_run") or {}).get("conclusion")
            or (payload.get("check_suite") or {}).get("conclusion")
            or (payload.get("workflow_run") or {}).get("conclusion")
        )
        name = (
            (payload.get("check_run") or {}).get("name")
            or (payload.get("workflow_run") or {}).get("name")
            or "GitHub check"
        )
        project.last_signal_at = utcnow()
        if conclusion in {"failure", "timed_out", "action_required"}:
            project.health_status = "incident"
            project.health_summary = f"GitHub {name} {conclusion}"
            project.incident_count = max(project.incident_count, 1)
        elif conclusion in {"success"}:
            project.health_status = "healthy"
            project.health_summary = f"GitHub {name} passed"
            project.incident_count = 0
        session.commit()
        return

    if event == "pull_request":
        pr = payload.get("pull_request") or {}
        branch = (pr.get("head") or {}).get("ref") or ""
        if not branch.startswith("pocket/"):
            return
        task_prefix = branch.split("/")[1][:8] if "/" in branch else ""
        if not task_prefix:
            return
        task = session.scalar(select(Task).where(Task.id.startswith(task_prefix)))
        if not task:
            return
        task.pull_request_url = pr.get("html_url") or task.pull_request_url
        task.pull_request_state = pr.get("state")
        session.commit()
        return

    if event == "installation":
        action = payload.get("action")
        installation_id = (payload.get("installation") or {}).get("id")
        if action == "deleted" and installation_id:
            projects = session.scalars(
                select(Project).where(Project.github_installation_id == installation_id)
            ).all()
            for project in projects:
                project.status = "disconnected"
            session.commit()
