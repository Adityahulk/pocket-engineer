from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, class_=Session)

_PROJECT_COLUMNS = {
    "owner_user_id": "VARCHAR(64)",
    "health_status": "VARCHAR(32) DEFAULT 'healthy'",
    "health_summary": "TEXT",
    "incident_count": "INTEGER DEFAULT 0",
    "last_signal_at": "TIMESTAMP",
}
_TASK_COLUMNS = {
    "owner_user_id": "VARCHAR(64)",
    "priority": "VARCHAR(16) DEFAULT 'normal'",
    "autonomy": "VARCHAR(16) DEFAULT 'assisted'",
    "investigation": "JSON",
    "feedback": "TEXT",
    "pull_request_state": "VARCHAR(32)",
    "engineer_name": "VARCHAR(80) DEFAULT 'Alex'",
    "engineer_provider": "VARCHAR(80) DEFAULT 'Pocket Engineer'",
}


def _add_missing_columns(table: str, columns: dict[str, str]) -> None:
    existing = {column["name"] for column in inspect(engine).get_columns(table)}
    with engine.begin() as connection:
        for name, ddl in columns.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def create_schema() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(engine)
    _add_missing_columns("projects", _PROJECT_COLUMNS)
    _add_missing_columns("tasks", _TASK_COLUMNS)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
