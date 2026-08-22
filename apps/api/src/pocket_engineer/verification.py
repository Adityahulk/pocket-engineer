from __future__ import annotations

import json
import time
from pathlib import Path

from .config import Settings
from .repository import run_command


def dependency_setup(workspace: Path) -> list[tuple[str, list[str]]]:
    setup: list[tuple[str, list[str]]] = []
    if (workspace / "pyproject.toml").exists():
        if (workspace / "uv.lock").exists():
            setup.append(("Python dependencies", ["uv", "sync", "--frozen", "--all-extras"]))
        else:
            setup.extend(
                [
                    ("Python environment", ["uv", "venv", ".pocket-venv"]),
                    (
                        "Python dependencies",
                        ["uv", "pip", "install", "--python", ".pocket-venv/bin/python", "-e", ".", "pytest"],
                    ),
                ]
            )
    elif (workspace / "requirements.txt").exists():
        setup.extend(
            [
                ("Python environment", ["uv", "venv", ".pocket-venv"]),
                (
                    "Python dependencies",
                    [
                        "uv", "pip", "install", "--python", ".pocket-venv/bin/python",
                        "-r", "requirements.txt", "pytest",
                    ],
                ),
            ]
        )

    if (workspace / "package.json").exists():
        if (workspace / "package-lock.json").exists():
            setup.append(("JavaScript dependencies", ["npm", "ci", "--ignore-scripts", "--no-audit"]))
        else:
            setup.append(
                ("JavaScript dependencies", ["npm", "install", "--ignore-scripts", "--no-audit", "--no-package-lock"])
            )
    return setup


def discover_checks(workspace: Path) -> list[tuple[str, str, list[str]]]:
    checks: list[tuple[str, str, list[str]]] = []
    if (workspace / "tests").exists() and any(
        (workspace / filename).exists() for filename in ("pyproject.toml", "pytest.ini", "requirements.txt")
    ):
        python = "uv" if (workspace / "uv.lock").exists() else ".pocket-venv/bin/python"
        command = ["uv", "run", "pytest", "-q"] if python == "uv" else [python, "-m", "pytest", "-q"]
        checks.append(("Python tests", "test", command))

    package_json = workspace / "package.json"
    if package_json.exists():
        try:
            scripts = json.loads(package_json.read_text()).get("scripts", {})
        except (json.JSONDecodeError, OSError):
            scripts = {}
        if "typecheck" in scripts:
            checks.append(("TypeScript", "typecheck", ["npm", "run", "typecheck", "--", "--pretty", "false"]))
        if "test" in scripts and "no test specified" not in str(scripts["test"]):
            checks.append(("JavaScript tests", "test", ["npm", "test"]))

    if not checks:
        checks.append(("Repository checks", "test", []))
    return checks


def verify(workspace: Path, settings: Settings) -> list[dict]:
    results: list[dict] = []
    for name, command in dependency_setup(workspace):
        started = time.monotonic()
        result = run_command(
            command,
            workspace,
            settings.command_timeout_seconds,
            extra_env={"CI": "true"},
        )
        status = "passed" if result.returncode == 0 else "failed"
        results.append(
            {
                "name": name,
                "category": "setup",
                "status": status,
                "command": " ".join(command),
                "duration_ms": round((time.monotonic() - started) * 1000),
                "output": result.stdout[-5000:],
                "required": True,
            }
        )
        if status == "failed":
            return results
    for name, category, command in discover_checks(workspace):
        if not command:
            results.append(
                {
                    "name": name,
                    "category": category,
                    "status": "blocked",
                    "command": None,
                    "duration_ms": 0,
                    "output": "No supported repository check was discovered.",
                    "required": True,
                }
            )
            continue
        started = time.monotonic()
        result = run_command(command, workspace, settings.command_timeout_seconds, extra_env={"CI": "true"})
        results.append(
            {
                "name": name,
                "category": category,
                "status": "passed" if result.returncode == 0 else "failed",
                "command": " ".join(command),
                "duration_ms": round((time.monotonic() - started) * 1000),
                "output": result.stdout[-5000:],
                "required": True,
            }
        )
    return results
