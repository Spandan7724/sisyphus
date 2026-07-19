"""Tests for the DB pragmas, artifact store, event stream, and prompt loader."""

import pytest
import sqlalchemy as sa

from job_appli.artifacts.store import ArtifactStore
from job_appli.db.models import DomainEvent
from job_appli.events.publisher import publisher
from job_appli.llm.prompts import load_prompt


def test_sqlite_pragmas(db):
    with db.engine.connect() as conn:
        assert conn.execute(sa.text("PRAGMA journal_mode")).scalar() == "wal"
        assert conn.execute(sa.text("PRAGMA foreign_keys")).scalar() == 1


def test_artifact_store_roundtrip(settings, db):
    store = ArtifactStore(settings.artifacts_dir)
    with db.session() as session:
        artifact = store.save(
            session, content=b"hello resume", kind="resume", original_filename="cv.pdf"
        )
        assert store.read(artifact) == b"hello resume"
        assert artifact.sha256
        assert artifact.size_bytes == 12
        assert artifact.relative_path.endswith(".pdf")


def test_artifact_rejects_path_traversal_filenames(settings, db):
    store = ArtifactStore(settings.artifacts_dir)
    with db.session() as session:
        artifact = store.save(
            session, content=b"x", kind="resume", original_filename="../../evil.pdf"
        )
        assert artifact.original_filename == "evil.pdf"
        assert (settings.artifacts_dir / artifact.relative_path).is_file()


def test_event_append_and_replay(db):
    with db.session() as session:
        event = publisher.append(
            session,
            event_type="test.created",
            aggregate_type="test",
            aggregate_id="t-1",
            actor="system",
            reason="unit test",
        )
        assert event.id is not None
    with db.session() as session:
        rows = session.execute(sa.select(DomainEvent)).scalars().all()
        assert len(rows) == 1
        assert rows[0].event_type == "test.created"


def test_prompt_loader_picks_latest_version(tmp_path, monkeypatch):
    import job_appli.llm.prompts as prompts_module

    monkeypatch.setattr(prompts_module, "PROMPTS_DIR", tmp_path)
    (tmp_path / "greet.v1.md").write_text("one")
    (tmp_path / "greet.v2.md").write_text("two")
    latest = load_prompt("greet")
    assert (latest.version, latest.text) == ("v2", "two")
    pinned = load_prompt("greet", version=1)
    assert pinned.text == "one"
    with pytest.raises(FileNotFoundError):
        load_prompt("missing")
