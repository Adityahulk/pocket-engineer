from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from .config import Settings
from .repository import run_command


class AgentError(RuntimeError):
    pass


@dataclass
class AgentResult:
    summary: str
    root_cause: str


class DemoAgent:
    """A deterministic agent for the bundled checkout fixture.

    It exists so the complete product loop can be run without sending source code
    to a model provider. It intentionally refuses unknown repositories.
    """

    def execute(self, workspace: Path, goal: str) -> AgentResult:
        target = workspace / "src" / "checkout.py"
        if not target.exists():
            raise AgentError(
                "The demo agent only supports the bundled checkout repository. "
                "Set POCKET_AGENT_PROVIDER=aider and configure an Aider-supported model for real repositories."
            )

        original = target.read_text()
        vulnerable = 'discount_rate = customer.get("discount")\n    return round(subtotal * (1 - discount_rate), 2)'
        fixed = 'discount_rate = customer.get("discount") or 0.0\n    return round(subtotal * (1 - discount_rate), 2)'
        if vulnerable not in original:
            raise AgentError("The demo repository no longer contains the expected checkout defect.")
        target.write_text(original.replace(vulnerable, fixed))
        return AgentResult(
            summary="Handled customers without a discount while preserving existing discounted checkout behavior.",
            root_cause=(
                "The checkout total multiplied by `1 - discount_rate`, but `dict.get` returned `None` "
                "for customers without a discount. Subtracting `None` raised a TypeError and surfaced as a 500."
            ),
        )


class AiderAgent:
    """Delegates repository editing to the established open-source Aider coding agent."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def execute(self, workspace: Path, goal: str) -> AgentResult:
        if not shutil.which("aider"):
            raise AgentError("Aider is not installed. Run `uv sync --extra agent` in apps/api.")
        prompt = (
            "You are implementing one focused task for Pocket Engineer. Inspect the repository before editing. "
            "Make the smallest correct change. Do not commit, push, deploy, read secrets, or change CI permissions. "
            f"Task: {goal}"
        )
        result = run_command(
            [
                "aider",
                "--yes-always",
                "--no-auto-commits",
                "--no-gitignore",
                "--model",
                self.settings.aider_model,
                "--message",
                prompt,
            ],
            workspace,
            self.settings.command_timeout_seconds,
        )
        if result.returncode != 0:
            raise AgentError(f"Aider failed: {result.stdout[-3000:]}")
        return AgentResult(
            summary="Implemented the requested focused change with the configured coding agent.",
            root_cause="See the task evidence and patch for the agent's repository-specific diagnosis.",
        )


def build_agent(settings: Settings):
    if settings.agent_provider == "demo":
        return DemoAgent()
    if settings.agent_provider == "aider":
        return AiderAgent(settings)
    raise AgentError(f"Unknown agent provider: {settings.agent_provider}")

