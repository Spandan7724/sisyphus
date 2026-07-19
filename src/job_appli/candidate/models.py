"""Candidate memory tables: revisioned facts, structured stories, resumes."""

from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from job_appli.db.base import Base, utcnow
from job_appli.db.models import new_id

SOURCE_RESUME = "resume"
SOURCE_ONBOARDING = "onboarding"
SOURCE_MANUAL = "manual"
SOURCE_APPLICATION_LEARNED = "application_learned"
SOURCE_IMPORT = "import"

SENSITIVITY_NORMAL = "normal"
SENSITIVITY_SENSITIVE = "sensitive"
SENSITIVITY_LEGAL = "legal"


class CandidateFact(Base):
    __tablename__ = "candidate_fact"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    section: Mapped[str] = mapped_column(sa.String(50), index=True)
    key: Mapped[str] = mapped_column(sa.String(100), index=True)
    value: Mapped[dict[str, Any]] = mapped_column(sa.JSON())

    source_type: Mapped[str] = mapped_column(sa.String(30))
    source_artifact_id: Mapped[str | None] = mapped_column(
        sa.ForeignKey("artifact.id"), nullable=True
    )
    source_span: Mapped[str | None] = mapped_column(sa.Text())

    confidence: Mapped[float | None] = mapped_column(sa.Float())
    confirmed: Mapped[bool] = mapped_column(default=False, index=True)
    reuse_permitted: Mapped[bool] = mapped_column(default=True)
    sensitivity: Mapped[str] = mapped_column(sa.String(20), default=SENSITIVITY_NORMAL)

    superseded_by: Mapped[str | None] = mapped_column(
        sa.ForeignKey("candidate_fact.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class CandidateStory(Base):
    __tablename__ = "candidate_story"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(sa.String(200))
    context: Mapped[str | None] = mapped_column(sa.Text())
    problem: Mapped[str | None] = mapped_column(sa.Text())
    role: Mapped[str | None] = mapped_column(sa.Text())
    decisions: Mapped[str | None] = mapped_column(sa.Text())
    actions: Mapped[str | None] = mapped_column(sa.Text())
    obstacles: Mapped[str | None] = mapped_column(sa.Text())
    result: Mapped[str | None] = mapped_column(sa.Text())
    learned: Mapped[str | None] = mapped_column(sa.Text())
    motivation: Mapped[str | None] = mapped_column(sa.Text())
    skills: Mapped[list[str]] = mapped_column(sa.JSON(), default=list)
    themes: Mapped[list[str]] = mapped_column(sa.JSON(), default=list)
    shareability: Mapped[str | None] = mapped_column(sa.Text())

    source_type: Mapped[str] = mapped_column(sa.String(30))
    source_artifact_id: Mapped[str | None] = mapped_column(
        sa.ForeignKey("artifact.id"), nullable=True
    )
    confirmed: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class InterviewQuestionRecord(Base):
    __tablename__ = "interview_question"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    section: Mapped[str] = mapped_column(sa.String(50))
    key: Mapped[str] = mapped_column(sa.String(100))
    question: Mapped[str] = mapped_column(sa.Text())
    rationale: Mapped[str | None] = mapped_column(sa.Text())
    status: Mapped[str] = mapped_column(sa.String(20), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    __table_args__ = (
        sa.UniqueConstraint("section", "key", name="uq_interview_question_slot"),
    )


class Resume(Base):
    __tablename__ = "resume"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    artifact_id: Mapped[str] = mapped_column(sa.ForeignKey("artifact.id"))
    label: Mapped[str] = mapped_column(sa.String(100))
    is_default: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
