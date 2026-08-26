from fastapi import HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .auth import AuthenticatedUser
from .config import Settings
from .models import GitHubInstallation, Project, Task


def current_user(request: Request) -> AuthenticatedUser:
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(401, "Authentication required")
    return user


def owns_filter(settings: Settings) -> bool:
    return settings.auth_mode != "disabled"


def visible_projects(session: Session, user: AuthenticatedUser, settings: Settings) -> list[Project]:
    query = select(Project).order_by(Project.created_at.desc())
    if owns_filter(settings):
        query = query.where(or_(Project.owner_user_id == user.id, Project.is_demo.is_(True)))
    return list(session.scalars(query).all())


def get_project(session: Session, project_id: str, user: AuthenticatedUser, settings: Settings) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if owns_filter(settings) and not project.is_demo and project.owner_user_id not in {None, user.id}:
        raise HTTPException(404, "Project not found")
    return project


def get_task(session: Session, task_id: str, user: AuthenticatedUser, settings: Settings) -> Task:
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    get_project(session, task.project_id, user, settings)
    return task


def bind_installation(session: Session, user: AuthenticatedUser, installation_id: int, settings: Settings) -> GitHubInstallation:
    existing = session.scalar(
        select(GitHubInstallation).where(GitHubInstallation.installation_id == installation_id)
    )
    if existing:
        if owns_filter(settings) and existing.user_id != user.id:
            raise HTTPException(403, "This GitHub installation belongs to another account")
        return existing
    record = GitHubInstallation(user_id=user.id, installation_id=installation_id)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def require_installation(session: Session, user: AuthenticatedUser, installation_id: int, settings: Settings) -> None:
    bind_installation(session, user, installation_id, settings)
