from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .config import Settings
from .models import Project


class RepositoryError(RuntimeError):
    pass


@dataclass
class Workspace:
    path: Path
    base_sha: str


def run_command(
    args: list[str],
    cwd: Path,
    timeout: int,
    *,
    input_text: str | None = None,
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        args,
        cwd=cwd,
        env=env,
        text=True,
        input=input_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )


class RepositoryManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.root = settings.resolve_from_api(settings.workspace_root)
        self.root.mkdir(parents=True, exist_ok=True)

    def prepare(self, project: Project, task_id: str, github_token: str | None = None) -> Workspace:
        destination = self.root / task_id
        if destination.exists():
            shutil.rmtree(destination)

        if project.local_path:
            source = Path(project.local_path).resolve()
            if not source.exists():
                raise RepositoryError(f"Local repository does not exist: {source}")
            shutil.copytree(source, destination, ignore=shutil.ignore_patterns(".git", "__pycache__", ".pytest_cache"))
            self._initialize_git(destination)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            env = self.github_env(github_token)
            result = run_command(
                ["git", "clone", "--depth", "50", "--branch", project.default_branch, project.repo_url, str(destination)],
                cwd=destination.parent,
                timeout=self.settings.command_timeout_seconds,
                extra_env=env,
            )
            if result.returncode != 0:
                raise RepositoryError(f"Clone failed: {result.stdout[-2000:]}")

        sha = run_command(["git", "rev-parse", "HEAD"], destination, 20).stdout.strip()
        return Workspace(destination, sha)

    def diff(self, workspace: Workspace) -> str:
        result = run_command(
            ["git", "diff", "--no-ext-diff", "--unified=3"],
            workspace.path,
            30,
        )
        return result.stdout

    def cleanup(self, workspace: Workspace | None) -> None:
        if workspace and workspace.path.exists():
            shutil.rmtree(workspace.path, ignore_errors=True)

    @staticmethod
    def github_env(token: str | None) -> dict[str, str]:
        if not token:
            return {}
        import base64

        auth = base64.b64encode(f"x-access-token:{token}".encode()).decode()
        return {
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
            "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: basic {auth}",
        }

    def publish_patch(
        self,
        project: Project,
        task_id: str,
        base_sha: str,
        patch: str,
        token: str,
        branch: str,
        commit_message: str,
    ) -> None:
        workspace = self.prepare(project, f"publish-{task_id}", token)
        try:
            if workspace.base_sha != base_sha:
                raise RepositoryError(
                    "The default branch moved after verification. Re-run the task against the latest commit before publishing."
                )
            checked = run_command(
                ["git", "apply", "--check", "-"], workspace.path, 30, input_text=patch
            )
            if checked.returncode != 0:
                raise RepositoryError(f"Reviewed patch no longer applies: {checked.stdout[-2000:]}")
            applied = run_command(
                ["git", "apply", "--whitespace=fix", "-"], workspace.path, 30, input_text=patch
            )
            if applied.returncode != 0:
                raise RepositoryError(f"Patch apply failed: {applied.stdout[-2000:]}")
            commands = [
                ["git", "switch", "-c", branch],
                ["git", "config", "user.email", "agent@pocket-engineer.app"],
                ["git", "config", "user.name", "Pocket Engineer"],
                ["git", "add", "-A"],
                ["git", "commit", "-m", commit_message],
            ]
            for command in commands:
                result = run_command(command, workspace.path, 60)
                if result.returncode != 0:
                    raise RepositoryError(result.stdout[-2000:])
            pushed = run_command(
                ["git", "push", "--set-upstream", "origin", branch],
                workspace.path,
                self.settings.command_timeout_seconds,
                extra_env=self.github_env(token),
            )
            if pushed.returncode != 0:
                raise RepositoryError(f"GitHub push failed: {pushed.stdout[-2000:]}")
        finally:
            self.cleanup(workspace)

    @staticmethod
    def _initialize_git(path: Path) -> None:
        commands = [
            ["git", "init", "-q"],
            ["git", "config", "user.email", "agent@pocket-engineer.local"],
            ["git", "config", "user.name", "Pocket Engineer"],
            ["git", "add", "."],
            ["git", "commit", "-q", "-m", "Fixture baseline"],
        ]
        for command in commands:
            result = run_command(command, path, 30)
            if result.returncode != 0:
                raise RepositoryError(result.stdout)
