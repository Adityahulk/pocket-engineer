from __future__ import annotations

from .config import Settings
from .models import Project, Task

VOICE_TOOLS = [
    {
        "type": "function",
        "name": "get_status",
        "description": "Get current software health, incidents, active missions, and pending decisions.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "mission_id": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "start_mission",
        "description": "Start engineering work immediately. Use when the user asked you to fix, change, or handle something.",
        "parameters": {
            "type": "object",
            "properties": {
                "goal": {"type": "string"},
                "mode": {"type": "string", "enum": ["fix", "modify"]},
                "priority": {"type": "string", "enum": ["normal", "high", "urgent"]},
                "autonomy": {
                    "type": "string",
                    "enum": ["assisted", "autopilot"],
                    "description": "autopilot ships a pull request after tests pass. assisted waits for a spoken or on-screen ship.",
                },
                "project_id": {"type": "string"},
            },
            "required": ["goal", "mode"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "ship_mission",
        "description": "Approve the verified patch and open a pull request. Use when the user says ship it, open the PR, or take care of the rest.",
        "parameters": {
            "type": "object",
            "properties": {"mission_id": {"type": "string"}},
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "reject_mission",
        "description": "Reject a verified patch so it is not published.",
        "parameters": {
            "type": "object",
            "properties": {
                "mission_id": {"type": "string"},
                "feedback": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
]


def voice_instructions(settings: Settings, project: Project | None, mission: Task | None, portfolio: str) -> str:
    context = [
        f"You are {settings.engineer_label} on a live phone call inside Pocket Engineer.",
        "You are the user's senior engineer. They talk; you do the work.",
        portfolio,
    ]
    if project:
        kind = "demo fixture" if project.is_demo else "connected software"
        context.append(
            f"Current software ({kind}): {project.name}. Health: {project.health_status}. "
            f"Status: {project.health_summary}."
        )
    if mission:
        context.append(
            f"Current mission: {mission.goal}. State: {mission.state}. "
            f"Summary: {mission.summary or 'No verified result yet.'} "
            f"PR: {mission.pull_request_url or 'none'}."
        )
    context.append(
        "Be warm, direct, and concise. Acknowledge before solving. Ask one question only when a decision is blocked. "
        "Do not read raw diffs, hashes, or logs aloud unless asked. "
        "When the user wants work done, call start_mission. If they said handle it, just fix it, or do everything, "
        "use autonomy=autopilot so you open the PR after tests pass. Otherwise use assisted. "
        "Never claim tests passed, a patch exists, or a PR is open unless get_status or mission context says so. "
        "After verification, call ship_mission when they ask to ship. Git writes are audited. "
        "Tell them what you started and where to watch it."
    )
    return " ".join(context)
