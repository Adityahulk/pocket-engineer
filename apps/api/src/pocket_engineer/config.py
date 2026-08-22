from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_prefix="POCKET_",
        extra="ignore",
    )

    app_name: str = "Pocket Engineer"
    environment: str = "development"
    database_url: str = "sqlite:///./pocket-engineer.db"
    cors_origins: str = "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006"
    demo_enabled: bool = True
    demo_repository_path: str = "fixtures/demo-checkout"
    worker_enabled: bool = True
    worker_poll_seconds: float = 0.35
    workspace_root: str = "workspaces"
    command_timeout_seconds: int = 180
    agent_provider: str = "demo"
    aider_model: str = "openai/gpt-5"
    sandbox_mode: str = "local"
    sandbox_image: str = "pocket-engineer-sandbox:latest"
    github_app_slug: str = ""
    github_app_id: str = ""
    github_private_key: str = ""
    github_token: str = ""
    github_api_url: str = "https://api.github.com"
    public_base_url: str = "http://localhost:8000"
    auth_mode: str = "disabled"
    auth_allowed_emails: str = ""
    supabase_url: str = ""
    openai_api_key: str = ""
    realtime_api_url: str = "https://api.openai.com"
    realtime_model: str = "gpt-realtime-2.1"
    realtime_voice: str = "marin"

    @property
    def allowed_origins(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]

    @property
    def allowed_auth_emails(self) -> set[str]:
        return {value.strip().lower() for value in self.auth_allowed_emails.split(",") if value.strip()}

    def resolve_from_api(self, value: str) -> Path:
        path = Path(value)
        if path.is_absolute():
            return path
        return (Path(__file__).resolve().parents[4] / value).resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
