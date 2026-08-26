from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select

from .agent import build_agent
from .config import Settings
from .database import SessionLocal, engine
from .events import append_event, transition
from .github import GitHubService
from .investigate import investigate
from .models import Task, utcnow
from .notify import notify_task
from .repository import RepositoryManager, Workspace
from .shipping import ShipError, ship_task
from .verification import verify

logger = logging.getLogger(__name__)

IN_FLIGHT = {"provisioning", "investigating", "planning", "implementing", "verifying"}


class TaskCancelled(RuntimeError):
    pass


class TaskRunner:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.repositories = RepositoryManager(settings)
        self.agent = build_agent(settings)
        self._stopping = False

    def reap_stale(self) -> None:
        cutoff = utcnow() - timedelta(minutes=self.settings.worker_stale_minutes)
        with SessionLocal() as session:
            stale = list(
                session.scalars(
                    select(Task).where(Task.state.in_(IN_FLIGHT), Task.updated_at < cutoff)
                ).all()
            )
            for task in stale:
                task.error = "The worker restarted or the mission exceeded the stale timeout."
                transition(session, task, "failed", "The Mission stopped safely after a worker interruption")
                notify_task(session, task)

    def run_task(self, task_id: str) -> None:
        workspace: Workspace | None = None
        with SessionLocal() as session:
            task = session.get(Task, task_id)
            if not task or task.state not in {"queued", "provisioning"}:
                return
            try:
                transition(session, task, "provisioning", "Creating an isolated repository workspace")
                github_token = None
                if not task.project.is_demo:
                    github_token = asyncio.run(
                        GitHubService(self.settings).installation_token(task.project.github_installation_id)
                    )
                workspace = self.repositories.prepare(task.project, task.id, github_token)
                self._guard_not_cancelled(session, task)
                task.base_sha = workspace.base_sha
                session.commit()

                transition(session, task, "investigating", "Inspecting repository structure and the reported behavior")
                investigation = investigate(workspace.path, task.goal)
                task.investigation = investigation
                session.commit()
                append_event(
                    session,
                    task,
                    "task.evidence_added",
                    investigation.get("notes") or "Repository snapshot pinned",
                    {"base_sha": workspace.base_sha, **{key: investigation[key] for key in ("file_count", "keywords") if key in investigation}},
                )
                transition(session, task, "planning", "Formed a focused implementation and verification plan")
                append_event(
                    session,
                    task,
                    "task.plan_ready",
                    "Change the smallest relevant surface, then run repository-native checks",
                    {"risk": "low", "remote_writes": False, "autonomy": task.autonomy},
                )

                self._guard_not_cancelled(session, task)
                transition(session, task, "implementing", "Applying the change inside the isolated workspace")
                agent_result = self.agent.execute(workspace.path, task.goal, investigation)
                self._guard_not_cancelled(session, task)
                task.summary = agent_result.summary
                task.root_cause = agent_result.root_cause
                session.commit()

                transition(session, task, "verifying", "Running the repository's verification checks")
                task.verification = verify(workspace.path, self.settings)
                task.diff = self.repositories.diff(workspace)
                session.commit()
                self._guard_not_cancelled(session, task)

                required_failed = any(
                    check["required"] and check["status"] != "passed" for check in task.verification
                )
                if not task.diff.strip():
                    raise RuntimeError("The agent completed without producing a code change.")
                if required_failed:
                    task.error = "One or more required verification checks did not pass."
                    transition(session, task, "failed", "The change was not reported as complete because verification failed")
                    notify_task(session, task)
                else:
                    transition(session, task, "ready_for_review", "The change is verified and ready for review")
                    append_event(
                        session,
                        task,
                        "task.approval_requested",
                        "Approval is required before creating a remote branch or pull request"
                        if task.autonomy != "autopilot"
                        else "Autopilot will open the pull request because you asked Alex to handle it",
                        {"action": "create_pull_request", "autonomy": task.autonomy},
                    )
                    if task.autonomy == "autopilot":
                        try:
                            ship_task(session, task, self.settings, approve=True)
                        except ShipError as exc:
                            task.error = str(exc)
                            transition(session, task, "failed", "Verified, but shipping the pull request failed")
                            notify_task(session, task)
                    else:
                        notify_task(session, task)
            except TaskCancelled:
                append_event(session, task, "task.cleanup_started", "Stopping work and destroying the workspace")
            except Exception as exc:  # task boundary: convert provider failures to durable state
                logger.exception("Task %s failed", task_id)
                task.error = str(exc)
                transition(session, task, "failed", "The Mission stopped safely", {"error": str(exc)})
                notify_task(session, task)
            finally:
                self.repositories.cleanup(workspace)

    def run_next(self) -> bool:
        with SessionLocal() as session:
            query = select(Task).where(Task.state == "queued").order_by(Task.created_at).limit(1)
            if engine.dialect.name == "postgresql":
                query = query.with_for_update(skip_locked=True)
            task = session.scalar(query)
            if not task:
                return False
            task.state = "provisioning"
            session.commit()
            task_id = task.id
        self.run_task(task_id)
        return True

    async def worker_loop(self) -> None:
        self._stopping = False
        await asyncio.to_thread(self.reap_stale)
        ticks = 0
        while not self._stopping:
            processed = await asyncio.to_thread(self.run_next)
            ticks += 1
            if ticks % 80 == 0:
                await asyncio.to_thread(self.reap_stale)
            if not processed:
                await asyncio.sleep(self.settings.worker_poll_seconds)

    def stop(self) -> None:
        self._stopping = True

    @staticmethod
    def _guard_not_cancelled(session, task: Task) -> None:
        session.refresh(task)
        if task.state == "cancelled":
            raise TaskCancelled()
