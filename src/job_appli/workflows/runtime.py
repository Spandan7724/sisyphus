"""DBOS runtime lifecycle: one shared SQLite file for all schemas."""

from dbos import DBOS, SQLAlchemyDatasource

from job_appli.config import Settings

_datasource: SQLAlchemyDatasource | None = None


def init_dbos(settings: Settings) -> SQLAlchemyDatasource:
    global _datasource
    settings.ensure_dirs()
    DBOS(
        config={
            "name": settings.dbos_app_name,
            "system_database_url": settings.database_url,
            "run_admin_server": False,
        }
    )
    _datasource = SQLAlchemyDatasource.create(settings.database_url)
    return _datasource


def get_datasource() -> SQLAlchemyDatasource:
    if _datasource is None:
        raise RuntimeError("DBOS not initialized; call init_dbos() first")
    return _datasource


def launch() -> None:
    DBOS.launch()


def shutdown() -> None:
    DBOS.destroy()
