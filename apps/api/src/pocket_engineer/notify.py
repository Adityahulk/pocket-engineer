from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import DeviceToken, Task

logger = logging.getLogger(__name__)

_TITLES = {
    "ready_for_review": "Patch ready for review",
    "failed": "Mission stopped",
    "completed": "Pull request opened",
    "cancelled": "Mission cancelled",
}


def register_device(session: Session, user_id: str, token: str, platform: str) -> DeviceToken:
    existing = session.scalar(select(DeviceToken).where(DeviceToken.expo_push_token == token))
    if existing:
        existing.user_id = user_id
        existing.platform = platform
        session.commit()
        session.refresh(existing)
        return existing
    device = DeviceToken(user_id=user_id, expo_push_token=token, platform=platform)
    session.add(device)
    session.commit()
    session.refresh(device)
    return device


def notify_task(session: Session, task: Task) -> None:
    user_id = task.owner_user_id or task.project.owner_user_id
    if not user_id:
        return
    tokens = list(session.scalars(select(DeviceToken).where(DeviceToken.user_id == user_id)).all())
    if not tokens:
        return
    title = _TITLES.get(task.state, "Mission update")
    body = task.goal[:140]
    messages = [
        {
            "to": device.expo_push_token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": {"taskId": task.id, "projectId": task.project_id, "state": task.state},
        }
        for device in tokens
    ]
    try:
        response = httpx.post("https://exp.host/--/api/v2/push/send", json=messages, timeout=10)
        if response.is_error:
            logger.warning("Expo push failed: %s %s", response.status_code, response.text[:300])
    except httpx.HTTPError:
        logger.warning("Expo push request failed", exc_info=True)
