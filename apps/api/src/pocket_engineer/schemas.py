from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    repo_url: str = Field(min_length=1, max_length=1024)
    repo_full_name: str | None = None
    default_branch: str = "main"
    github_installation_id: int | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    provider: str
    repo_url: str
    repo_full_name: str | None
    default_branch: str
    status: str
    is_demo: bool
    health_status: str = "healthy"
    health_summary: str = "No live alerts yet."
    incident_count: int = 0
    last_signal_at: datetime | None = None
    created_at: datetime


class TaskCreate(BaseModel):
    goal: str = Field(min_length=3, max_length=8000)
    mode: Literal["fix", "modify"] = "fix"
    priority: Literal["normal", "high", "urgent"] = "normal"
    autonomy: Literal["assisted", "autopilot"] = "assisted"


class VerificationCheck(BaseModel):
    name: str
    category: str
    status: Literal["passed", "failed", "blocked", "skipped", "not_applicable"]
    command: str | None = None
    duration_ms: int = 0
    output: str = ""
    required: bool = True


class TaskEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sequence: int
    event_type: str
    message: str
    details: dict
    created_at: datetime


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    goal: str
    mode: str
    priority: str = "normal"
    autonomy: str = "assisted"
    state: str
    base_sha: str | None
    summary: str | None
    root_cause: str | None
    investigation: dict = Field(default_factory=dict)
    diff: str | None
    verification: list[dict]
    error: str | None
    feedback: str | None = None
    approval_status: str
    pull_request_url: str | None
    pull_request_state: str | None = None
    engineer_name: str = "Alex"
    engineer_provider: str = "Pocket Engineer"
    created_at: datetime
    updated_at: datetime

    @field_validator("investigation", mode="before")
    @classmethod
    def default_investigation(cls, value: dict | None) -> dict:
        return value or {}


class ApprovalDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    feedback: str | None = Field(default=None, max_length=4000)


class GitHubConfigRead(BaseModel):
    enabled: bool
    installation_url: str | None


class GitHubRepositoryRead(BaseModel):
    full_name: str
    clone_url: str
    default_branch: str
    private: bool


class EngineerRead(BaseModel):
    id: str
    name: str
    specialty: str
    status: str
    current_mission_id: str | None = None
    project_id: str | None = None


class CommandCenterRead(BaseModel):
    portfolio_health: str
    active_missions: int
    approval_count: int
    incident_count: int
    engineer_name: str
    engineer_title: str
    projects: list[ProjectRead]
    engineers: list[EngineerRead]
    pending_decisions: list[TaskRead]
    active_mission_list: list[TaskRead]


class VoiceSessionCreate(BaseModel):
    project_id: str | None = None
    mission_id: str | None = None


class VoiceConfigRead(BaseModel):
    enabled: bool
    provider: str
    model: str
    voice: str
    engineer_name: str
    engineer_title: str


class VoiceToolCall(BaseModel):
    name: str
    arguments: dict = Field(default_factory=dict)
    project_id: str | None = None
    mission_id: str | None = None


class AuthConfigRead(BaseModel):
    required: bool
    provider: str
    supabase_url: str = ""
    supabase_publishable_key: str = ""


class DeviceRegister(BaseModel):
    expo_push_token: str = Field(min_length=8, max_length=255)
    platform: str = Field(default="unknown", max_length=16)


class AlertIngest(BaseModel):
    project_id: str | None = None
    repo_full_name: str | None = None
    severity: Literal["info", "warning", "error", "critical"] = "error"
    summary: str = Field(min_length=3, max_length=500)
    source: str = Field(default="webhook", max_length=80)
    resolved: bool = False
