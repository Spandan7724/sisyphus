"""Application settings loaded from defaults, .env, and the process environment."""

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


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

    llm_default_model: str = Field(
        default="openai:gpt-5.6-terra", validation_alias="LLM_DEFAULT_MODEL"
    )
    llm_fallback_model: str | None = Field(
        default=None, validation_alias="LLM_FALLBACK_MODEL"
    )
    llm_task_models: dict[str, str] = Field(
        default_factory=dict, validation_alias="LLM_TASK_MODELS"
    )
    llm_transport_retries: int = Field(
        default=2, validation_alias="LLM_TRANSPORT_RETRIES"
    )
    llm_validation_retries: int = Field(
        default=1, validation_alias="LLM_VALIDATION_RETRIES"
    )

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
