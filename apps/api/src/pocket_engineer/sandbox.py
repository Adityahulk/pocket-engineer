from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from .config import Settings

_SAFE_ENV = {
    "PATH",
    "HOME",
    "USER",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TERM",
    "TZ",
    "TMPDIR",
    "TMP",
    "TEMP",
    "CI",
}
_PROVIDER_ENV = (
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "OPENROUTER_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
)


def sanitized_env(extra: dict[str, str] | None = None, *, include_model_keys: bool = False) -> dict[str, str]:
    env = {key: os.environ[key] for key in _SAFE_ENV if key in os.environ}
    env["CI"] = "true"
    if include_model_keys:
        for key in _PROVIDER_ENV:
            if key in os.environ:
                env[key] = os.environ[key]
    if extra:
        env.update(extra)
    return env


def run_command(
    args: list[str],
    cwd: Path,
    timeout: int,
    *,
    input_text: str | None = None,
    extra_env: dict[str, str] | None = None,
    include_model_keys: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        env=sanitized_env(extra_env, include_model_keys=include_model_keys),
        text=True,
        input=input_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )


def docker_available() -> bool:
    return bool(shutil.which("docker"))


def run_in_sandbox(
    args: list[str],
    cwd: Path,
    timeout: int,
    settings: Settings,
    *,
    network: bool,
    extra_env: dict[str, str] | None = None,
    include_model_keys: bool = False,
) -> subprocess.CompletedProcess[str]:
    if settings.sandbox_mode != "docker" or not docker_available():
        return run_command(
            args,
            cwd,
            timeout,
            extra_env=extra_env,
            include_model_keys=include_model_keys,
        )
    docker_args = [
        "docker",
        "run",
        "--rm",
        "--cpus",
        "2",
        "--memory",
        "2g",
        "-v",
        f"{cwd.resolve()}:/workspace",
        "-w",
        "/workspace",
        "-u",
        "10001:10001",
    ]
    if not network:
        docker_args.extend(["--network", "none"])
    env = sanitized_env(extra_env, include_model_keys=include_model_keys)
    for key, value in env.items():
        docker_args.extend(["-e", f"{key}={value}"])
    docker_args.append(settings.sandbox_image)
    docker_args.extend(args)
    return subprocess.run(
        docker_args,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )
