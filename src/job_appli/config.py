"""Application settings loaded from defaults, .env, and the process environment."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="JOB_APPLI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    data_dir: Path = Path("data")

    host: str = "127.0.0.1"
    port: int = 8000

    dbos_enabled: bool = True
    dbos_app_name: str = "job-appli"

    llm_default_model: str = "openai:gpt-5-mini"
    llm_fallback_model: str | None = None
    llm_task_models: dict[str, str] = {}
    llm_transport_retries: int = 2
    llm_validation_retries: int = 1

    log_level: str = "INFO"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "job_appli.sqlite3"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path}"

    @property
    def artifacts_dir(self) -> Path:
        return self.data_dir / "artifacts"

    @property
    def browser_profile_dir(self) -> Path:
        return self.data_dir / "browser-profile"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
