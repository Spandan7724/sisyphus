"""Test fixtures: temp settings, migrated DB, client with DBOS disabled."""

import pytest
from fastapi.testclient import TestClient

from job_appli.config import Settings
from job_appli.db.base import Database
from job_appli.db.migrations import upgrade_schema
from job_appli.web.app import create_app


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(data_dir=tmp_path / "data", dbos_enabled=False)


@pytest.fixture
def db(settings) -> Database:
    settings.ensure_dirs()
    database = Database(settings.database_url)
    upgrade_schema(database.engine)
    return database


@pytest.fixture
def client(settings, db) -> TestClient:
    app = create_app(settings)
    app.state.db = db
    with TestClient(app) as test_client:
        yield test_client
