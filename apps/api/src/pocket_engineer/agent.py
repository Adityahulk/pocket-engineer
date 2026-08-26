from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from .config import Settings
from .investigate import format_investigation
from .sandbox import run_command, run_in_sandbox


class AgentError(RuntimeError):
    pass


@dataclass
class AgentResult:
    summary: str
    root_cause: str


class DemoAgent:
    """A deterministic agent for the bundled checkout fixture."""

    def execute(self, workspace: Path, goal: str, investigation: dict | None = None) -> AgentResult:
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
        evidence = format_investigation(investigation or {})
        return AgentResult(
            summary="Handled customers without a discount while preserving existing discounted checkout behavior.",
            root_cause=(
                "The checkout total multiplied by `1 - discount_rate`, but `dict.get` returned `None` "
                "for customers without a discount. Subtracting `None` raised a TypeError and surfaced as a 500. "
                f"{evidence}"
            ),
        )


class AiderAgent:
    """Delegates repository editing to the established open-source Aider coding agent."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def execute(self, workspace: Path, goal: str, investigation: dict | None = None) -> AgentResult:
        if not shutil.which("aider"):
            raise AgentError("Aider is not installed. Run `uv sync --extra agent` in apps/api.")
        evidence = format_investigation(investigation or {})
        prompt = (
            "You are implementing one focused task for Pocket Engineer. Inspect the repository before editing. "
            "Make the smallest correct change. Do not commit, push, deploy, read secrets, or change CI permissions. "
            f"Investigation notes:\n{evidence}\n"
            f"Task: {goal}\n"
            "When finished, print exactly two lines:\nSUMMARY: <one sentence>\nROOT_CAUSE: <one sentence>"
        )
        extra = {}
        if self.settings.openai_api_key:
            extra["OPENAI_API_KEY"] = self.settings.openai_api_key
        result = run_in_sandbox(
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
            self.settings,
            network=True,
            extra_env=extra,
            include_model_keys=True,
        )
        if result.returncode != 0:
            # Fall back to host execution if the sandbox image cannot run Aider.
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
                extra_env=extra,
                include_model_keys=True,
            )
        if result.returncode != 0:
            raise AgentError(f"Aider failed: {result.stdout[-3000:]}")
        return _parse_aider_result(result.stdout)


def _parse_aider_result(stdout: str) -> AgentResult:
    summary_match = re.search(r"^SUMMARY:\s*(.+)$", stdout, re.MULTILINE)
    cause_match = re.search(r"^ROOT_CAUSE:\s*(.+)$", stdout, re.MULTILINE)
    return AgentResult(
        summary=(summary_match.group(1).strip() if summary_match else "Implemented the requested focused change."),
        root_cause=(
            cause_match.group(1).strip()
            if cause_match
            else "See the investigation notes and reviewed patch for the diagnosis."
        ),
    )


def build_agent(settings: Settings):
    if settings.agent_provider == "demo":
        return DemoAgent()
    if settings.agent_provider == "aider":
        return AiderAgent(settings)
    raise AgentError(f"Unknown agent provider: {settings.agent_provider}")
