from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from starlette.responses import JSONResponse

from .config import Settings

_API_PREFIXES = ("/v1", "/health", "/docs", "/redoc", "/openapi.json", "/demo", "/pocket-config.js")


def web_dist(settings: Settings) -> Path | None:
    candidates = []
    if settings.web_root:
        candidates.append(Path(settings.web_root))
    candidates.append(Path("/app/web"))
    candidates.append(settings.resolve_from_api("apps/mobile/dist"))
    for path in candidates:
        if (path / "index.html").is_file():
            return path
    return None


def mount_web_app(app: FastAPI, dist: Path | None) -> None:
    if dist is None:
        return
    index = dist / "index.html"

    @app.get("/")
    async def web_root():
        return FileResponse(index)

    @app.get("/{full_path:path}")
    async def web_spa(full_path: str):
        target = f"/{full_path}"
        if any(target == prefix or target.startswith(prefix + "/") for prefix in _API_PREFIXES):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        file_path = dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(index)
