from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Task, TaskEvent


def append_event(
    session: Session,
    task: Task,
    event_type: str,
    message: str,
    details: dict | None = None,
) -> TaskEvent:
    current = session.scalar(select(func.max(TaskEvent.sequence)).where(TaskEvent.task_id == task.id)) or 0
    event = TaskEvent(
        task_id=task.id,
        sequence=current + 1,
        event_type=event_type,
        message=message,
        details=details or {},
    )
    session.add(event)
    session.commit()
    return event


def transition(session: Session, task: Task, state: str, message: str, details: dict | None = None) -> None:
    task.state = state
    session.add(task)
    session.commit()
    append_event(session, task, "task.state_changed", message, {"state": state, **(details or {})})

