from __future__ import annotations

import asyncio
import re

from sqlalchemy.orm import Session

from .config import Settings
from .events import append_event
from .github import GitHubError, GitHubService
from .models import Task
from .notify import notify_task
from .repository import RepositoryError, RepositoryManager


class ShipError(RuntimeError):
    pass


def ship_task(session: Session, task: Task, settings: Settings, *, approve: bool = False) -> Task:
    if task.state == "completed" and task.pull_request_url:
        return task
    if task.state != "ready_for_review":
        raise ShipError("Task is not ready to ship")
    if task.approval_status != "approved":
        if not approve:
            raise ShipError("Approved review is required before creating a pull request")
        task.approval_status = "approved"
        session.commit()
        append_event(session, task, "task.approval_resolved", "Patch approved for shipping", {"decision": "approved"})

    project = task.project
    if project.is_demo:
        task.pull_request_url = f"{settings.public_base_url}/demo/pull/{task.id}"
        task.pull_request_state = "open"
        task.state = "completed"
        session.commit()
        append_event(session, task, "pull_request.created", "Demo pull request created", {"url": task.pull_request_url})
        notify_task(session, task)
        session.refresh(task)
        return task

    github = GitHubService(settings)
    token = asyncio.run(github.installation_token(project.github_installation_id))
    if not token:
        raise ShipError("GitHub App credentials are not configured")
    if not project.repo_full_name or not task.diff or not task.base_sha:
        raise ShipError("Repository or reviewed patch metadata is incomplete")
    slug = re.sub(r"[^a-z0-9]+", "-", task.goal.lower()).strip("-")[:36]
    branch = f"pocket/{task.id[:8]}-{slug or 'change'}"
    repositories = RepositoryManager(settings)
    try:
        repositories.publish_patch(
            project,
            task.id,
            task.base_sha,
            task.diff,
            token,
            branch,
            f"fix: {task.goal[:65]}",
        )
        checks = "\n".join(
            f"- {'passed' if item['status'] == 'passed' else 'attention'} {item['name']}: {item['status']}"
            for item in task.verification
        )
        task.pull_request_url = asyncio.run(
            github.create_pull_request(
                project.repo_full_name,
                token,
                branch,
                project.default_branch,
                f"Pocket Engineer: {task.goal[:80]}",
                f"## Outcome\n\n{task.summary}\n\n## Root cause\n\n{task.root_cause}\n\n## Verification\n\n{checks}",
            )
        )
    except (GitHubError, RepositoryError, RuntimeError) as exc:
        raise ShipError(str(exc)) from exc
    task.pull_request_state = "open"
    task.state = "completed"
    session.commit()
    append_event(session, task, "pull_request.created", "GitHub pull request created", {"url": task.pull_request_url})
    notify_task(session, task)
    session.refresh(task)
    return task
