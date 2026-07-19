"""Shared tables: domain event stream, artifact metadata, LLM usage ledger."""

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from job_appli.db.base import Base, utcnow


def new_id() -> str:
    return str(uuid.uuid4())


class DomainEvent(Base):
    __tablename__ = "domain_event"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(sa.String(100), index=True)
    aggregate_type: Mapped[str] = mapped_column(sa.String(50), index=True)
    aggregate_id: Mapped[str] = mapped_column(sa.String(64), index=True)
    actor: Mapped[str] = mapped_column(sa.String(20))
    reason: Mapped[str | None] = mapped_column(sa.Text())
    payload: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON())
    workflow_id: Mapped[str | None] = mapped_column(sa.String(64))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Artifact(Base):
    __tablename__ = "artifact"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(sa.String(50), index=True)
    relative_path: Mapped[str] = mapped_column(sa.String(500))
    original_filename: Mapped[str | None] = mapped_column(sa.String(255))
    mime_type: Mapped[str | None] = mapped_column(sa.String(100))
    size_bytes: Mapped[int] = mapped_column(sa.Integer())
    sha256: Mapped[str] = mapped_column(sa.String(64), index=True)
    sensitivity: Mapped[str] = mapped_column(sa.String(20), default="personal")
    retention_class: Mapped[str] = mapped_column(sa.String(20), default="keep")
    owner_type: Mapped[str | None] = mapped_column(sa.String(50))
    owner_id: Mapped[str | None] = mapped_column(sa.String(64))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class LlmRun(Base):
    __tablename__ = "llm_run"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    task: Mapped[str] = mapped_column(sa.String(100), index=True)
    provider: Mapped[str] = mapped_column(sa.String(30))
    model: Mapped[str] = mapped_column(sa.String(100))
    prompt_ref: Mapped[str | None] = mapped_column(sa.String(100))
    prompt_version: Mapped[str | None] = mapped_column(sa.String(20))
    input_tokens: Mapped[int | None] = mapped_column(sa.Integer())
    output_tokens: Mapped[int | None] = mapped_column(sa.Integer())
    cost_usd: Mapped[float | None] = mapped_column(sa.Float())
    latency_ms: Mapped[int | None] = mapped_column(sa.Integer())
    retries: Mapped[int] = mapped_column(sa.Integer(), default=0)
    status: Mapped[str] = mapped_column(sa.String(20))
    error_category: Mapped[str | None] = mapped_column(sa.String(50))
    workflow_id: Mapped[str | None] = mapped_column(sa.String(64))
    application_id: Mapped[str | None] = mapped_column(sa.String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
