from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
    health_summary: str = "Production healthy"
    incident_count: int = 0
    created_at: datetime


class TaskCreate(BaseModel):
    goal: str = Field(min_length=3, max_length=8000)
    mode: Literal["fix", "modify"] = "fix"


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
    state: str
    base_sha: str | None
    summary: str | None
    root_cause: str | None
    diff: str | None
    verification: list[dict]
    error: str | None
    approval_status: str
    pull_request_url: str | None
    engineer_name: str = "AI Engineer"
    engineer_provider: str = "Pocket Router"
    created_at: datetime
    updated_at: datetime


class ApprovalDecision(BaseModel):
    decision: Literal["approved", "rejected"]


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
    projects: list[ProjectRead]
    engineers: list[EngineerRead]


class VoiceSessionCreate(BaseModel):
    project_id: str | None = None
    mission_id: str | None = None


class VoiceConfigRead(BaseModel):
    enabled: bool
    provider: str
    model: str
    voice: str


class AuthConfigRead(BaseModel):
    required: bool
    provider: str
