import subprocess
from pathlib import Path

from pocket_engineer.config import Settings
from pocket_engineer.models import Project
from pocket_engineer.repository import RepositoryManager


def git(cwd: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True
    )
    return result.stdout.strip()


def test_publish_patch_pushes_the_exact_reviewed_change(tmp_path: Path):
    source = tmp_path / "source"
    source.mkdir()
    git(source, "init", "-q", "-b", "main")
    git(source, "config", "user.email", "test@example.com")
    git(source, "config", "user.name", "Test")
    (source / "app.py").write_text("value = 1\n")
    git(source, "add", ".")
    git(source, "commit", "-q", "-m", "baseline")

    remote = tmp_path / "remote.git"
    git(tmp_path, "clone", "-q", "--bare", str(source), str(remote))
    project = Project(
        name="Fixture",
        provider="github",
        repo_url=str(remote),
        repo_full_name="test/fixture",
        default_branch="main",
    )
    manager = RepositoryManager(Settings(workspace_root=str(tmp_path / "workspaces"), demo_enabled=False))
    workspace = manager.prepare(project, "snapshot")
    base_sha = workspace.base_sha
    manager.cleanup(workspace)

    patch = """diff --git a/app.py b/app.py
index 0a979d4..c98224f 100644
--- a/app.py
+++ b/app.py
@@ -1 +1 @@
-value = 1
+value = 2
"""
    manager.publish_patch(
        project,
        "task-1",
        base_sha,
        patch,
        "local-test-token",
        "pocket/task-1-fix",
        "fix: update value",
    )

    published = subprocess.run(
        ["git", f"--git-dir={remote}", "show", "pocket/task-1-fix:app.py"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=True,
    ).stdout
    assert published == "value = 2\n"

