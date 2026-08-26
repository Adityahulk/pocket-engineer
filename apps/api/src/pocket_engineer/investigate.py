from __future__ import annotations

import re
import shutil
from pathlib import Path

from .sandbox import run_command

_SKIP_DIRS = {
    ".git",
    ".venv",
    ".pocket-venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "build",
    ".next",
}
_SOURCE_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".rb", ".md"}


def investigate(workspace: Path, goal: str) -> dict:
    files = _list_files(workspace)
    keywords = _keywords(goal)
    hits = _search(workspace, keywords)
    return {
        "file_count": len(files),
        "files": files[:40],
        "keywords": keywords,
        "hits": hits[:24],
        "notes": _notes(files, hits),
    }


def format_investigation(payload: dict) -> str:
    files = ", ".join(payload.get("files", [])[:12]) or "none"
    hits = payload.get("hits") or []
    hit_lines = "\n".join(
        f"- {item['path']}:{item['line']}: {item['text'][:160]}" for item in hits[:12]
    )
    return (
        f"Repository files sampled: {files}. "
        f"Keyword hits:\n{hit_lines or '- no exact keyword matches'}"
    )


def _list_files(workspace: Path) -> list[str]:
    files: list[str] = []
    for path in workspace.rglob("*"):
        if not path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in _SOURCE_SUFFIXES:
            continue
        files.append(str(path.relative_to(workspace)))
        if len(files) >= 80:
            break
    return files


def _keywords(goal: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_]{2,}", goal.lower())
    stop = {"the", "and", "for", "with", "that", "this", "from", "into", "when", "without", "customers", "should"}
    unique: list[str] = []
    for token in tokens:
        if token in stop or token in unique:
            continue
        unique.append(token)
        if len(unique) >= 8:
            break
    return unique or ["error"]


def _search(workspace: Path, keywords: list[str]) -> list[dict]:
    query = "|".join(re.escape(word) for word in keywords[:6])
    if shutil.which("rg"):
        result = run_command(
            ["rg", "-n", "-S", "--hidden", "-g", "!.git", "-g", "!node_modules", "-g", "!.venv", query, "."],
            workspace,
            20,
        )
        return _parse_rg(result.stdout)
    hits: list[dict] = []
    pattern = re.compile(query, re.IGNORECASE)
    for relative in _list_files(workspace):
        path = workspace / relative
        try:
            for index, line in enumerate(path.read_text(errors="ignore").splitlines(), start=1):
                if pattern.search(line):
                    hits.append({"path": relative, "line": index, "text": line.strip()})
                    if len(hits) >= 24:
                        return hits
        except OSError:
            continue
    return hits


def _parse_rg(stdout: str) -> list[dict]:
    hits: list[dict] = []
    for raw in stdout.splitlines():
        path, _, rest = raw.partition(":")
        line_no, _, text = rest.partition(":")
        if not path or not line_no.isdigit():
            continue
        hits.append({"path": path, "line": int(line_no), "text": text.strip()})
        if len(hits) >= 24:
            break
    return hits


def _notes(files: list[str], hits: list[dict]) -> str:
    if hits:
        top = hits[0]
        return f"Most relevant evidence is {top['path']}:{top['line']}."
    if files:
        return f"No keyword matches. Repository has {len(files)} source files to inspect."
    return "The workspace looks empty or unsupported."
