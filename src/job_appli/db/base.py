"""SQLite engine setup (WAL, foreign keys, busy timeout) and session management."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: sa.JSON, list[str]: sa.JSON}


def utcnow() -> datetime:
    return datetime.now(UTC)


def create_engine(database_url: str) -> sa.Engine:
    engine = sa.create_engine(database_url)

    @event.listens_for(engine, "connect")
    def _set_pragmas(dbapi_conn: Any, _record: Any) -> None:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    return engine


class Database:
    def __init__(self, database_url: str) -> None:
        self.engine = create_engine(database_url)
        self._sessionmaker = sessionmaker(bind=self.engine, expire_on_commit=False)

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self._sessionmaker()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
