"""search preferences

Revision ID: 7c4e2b9a1f03
Revises: f3778be70360
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7c4e2b9a1f03"
down_revision: str | Sequence[str] | None = "f3778be70360"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "search_preference_set",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("search_preference_set") as batch_op:
        batch_op.create_index(
            batch_op.f("ix_search_preference_set_is_active"),
            ["is_active"],
            unique=False,
        )

    op.create_table(
        "search_preference",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("preference_set_id", sa.String(length=36), nullable=False),
        sa.Column("strength", sa.String(length=10), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("operator", sa.String(length=20), nullable=False),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["preference_set_id"], ["search_preference_set.id"]
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "preference_set_id",
            "strength",
            "category",
            "operator",
            name="uq_search_preference_rule",
        ),
    )
    with op.batch_alter_table("search_preference") as batch_op:
        batch_op.create_index(
            batch_op.f("ix_search_preference_category"),
            ["category"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_search_preference_enabled"), ["enabled"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_search_preference_preference_set_id"),
            ["preference_set_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_search_preference_strength"),
            ["strength"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("search_preference") as batch_op:
        batch_op.drop_index(batch_op.f("ix_search_preference_strength"))
        batch_op.drop_index(batch_op.f("ix_search_preference_preference_set_id"))
        batch_op.drop_index(batch_op.f("ix_search_preference_enabled"))
        batch_op.drop_index(batch_op.f("ix_search_preference_category"))
    op.drop_table("search_preference")
    with op.batch_alter_table("search_preference_set") as batch_op:
        batch_op.drop_index(batch_op.f("ix_search_preference_set_is_active"))
    op.drop_table("search_preference_set")
