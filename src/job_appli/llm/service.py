"""LLM gateway: task-based routing, fallback, and a ledger row per call."""

import time

from pydantic_ai import Agent

from job_appli.config import Settings
from job_appli.db.base import Database
from job_appli.db.models import LlmRun
from job_appli.llm.prompts import Prompt


class LLMService:
    def __init__(self, settings: Settings, db: Database) -> None:
        self._settings = settings
        self._db = db

    def model_for(self, task: str) -> str:
        overrides = self._settings.llm_task_models
        return overrides.get(task, self._settings.llm_default_model)

    def run[T](
        self,
        task: str,
        *,
        output_type: type[T],
        user_prompt: str,
        prompt: Prompt | None = None,
        application_id: str | None = None,
        workflow_id: str | None = None,
    ) -> T:
        model = self.model_for(task)
        try:
            return self._attempt(
                task,
                model,
                output_type=output_type,
                user_prompt=user_prompt,
                prompt=prompt,
                application_id=application_id,
                workflow_id=workflow_id,
            )
        except Exception:
            fallback = self._settings.llm_fallback_model
            if fallback is None or fallback == model:
                raise
            return self._attempt(
                task,
                fallback,
                output_type=output_type,
                user_prompt=user_prompt,
                prompt=prompt,
                application_id=application_id,
                workflow_id=workflow_id,
            )

    def _attempt[T](
        self,
        task: str,
        model: str,
        *,
        output_type: type[T],
        user_prompt: str,
        prompt: Prompt | None,
        application_id: str | None,
        workflow_id: str | None,
    ) -> T:
        provider = model.split(":", 1)[0]
        agent: Agent[None, T] = Agent(
            model,
            output_type=output_type,
            instructions=prompt.text if prompt else None,
            retries=self._settings.llm_validation_retries,
        )
        start = time.monotonic()
        status, error_category = "success", None
        input_tokens = output_tokens = None
        try:
            result = agent.run_sync(user_prompt)
            input_tokens = result.usage.input_tokens
            output_tokens = result.usage.output_tokens
            return result.output
        except Exception as exc:
            status, error_category = "error", type(exc).__name__
            raise
        finally:
            latency_ms = int((time.monotonic() - start) * 1000)
            with self._db.session() as session:
                session.add(
                    LlmRun(
                        task=task,
                        provider=provider,
                        model=model,
                        prompt_ref=prompt.ref if prompt else None,
                        prompt_version=prompt.version if prompt else None,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        latency_ms=latency_ms,
                        status=status,
                        error_category=error_category,
                        workflow_id=workflow_id,
                        application_id=application_id,
                    )
                )
