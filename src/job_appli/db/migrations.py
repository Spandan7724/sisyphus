"""Apply the application's Alembic migrations to a database engine."""

from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

PROJECT_ROOT = Path(__file__).parents[3]


def upgrade_schema(engine: sa.Engine) -> None:
    """Upgrade the domain schema to the latest Alembic revision."""
    config = Config(PROJECT_ROOT / "alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
