"""Persisted hard constraints and soft job-search preferences."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from job_appli.db.base import Base, utcnow
from job_appli.db.models import new_id


class SearchPreferenceSet(Base):
    __tablename__ = "search_preference_set"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(sa.String(100), default="Default search")
    is_active: Mapped[bool] = mapped_column(default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class SearchPreference(Base):
    __tablename__ = "search_preference"

    id: Mapped[str] = mapped_column(sa.String(36), primary_key=True, default=new_id)
    preference_set_id: Mapped[str] = mapped_column(
        sa.ForeignKey("search_preference_set.id"), index=True
    )
    strength: Mapped[str] = mapped_column(sa.String(10), index=True)
    category: Mapped[str] = mapped_column(sa.String(40), index=True)
    operator: Mapped[str] = mapped_column(sa.String(20))
    values: Mapped[list[str]] = mapped_column(sa.JSON())
    enabled: Mapped[bool] = mapped_column(default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    __table_args__ = (
        sa.UniqueConstraint(
            "preference_set_id",
            "strength",
            "category",
            "operator",
            name="uq_search_preference_rule",
        ),
    )
