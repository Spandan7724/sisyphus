"""FastAPI application factory: API routes, SSE event stream, and the built SPA."""

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

import sqlalchemy as sa
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from job_appli.artifacts.store import ArtifactStore
from job_appli.config import Settings, get_settings
from job_appli.db.base import Database
from job_appli.db.models import DomainEvent
from job_appli.events.publisher import publisher

FRONTEND_DIST = Path(__file__).parents[3] / "frontend" / "dist"


class Ping(BaseModel):
    status: str
    app: str


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    settings.ensure_dirs()
    db = Database(settings.database_url)
    artifacts = ArtifactStore(settings.artifacts_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        publisher.bind_loop(asyncio.get_running_loop())
        if settings.dbos_enabled:
            from job_appli.workflows import runtime

            runtime.init_dbos(settings)
            runtime.launch()
        yield
        if settings.dbos_enabled:
            from job_appli.workflows import runtime

            runtime.shutdown()

    from job_appli.llm.service import LLMService

    app = FastAPI(title="job-appli", lifespan=lifespan)
    app.state.settings = settings
    app.state.db = db
    app.state.artifacts = artifacts
    app.state.llm = LLMService(settings, db)

    @app.get("/api/ping", response_model=Ping)
    def ping() -> Ping:
        return Ping(status="ok", app=settings.dbos_app_name)

    @app.get("/api/events")
    async def events(
        request: Request, cursor: int = 0, replay_only: bool = False
    ) -> StreamingResponse:
        queue = publisher.subscribe()

        def _replay() -> list[dict]:
            with db.session() as session:
                rows = (
                    session.execute(
                        sa.select(DomainEvent)
                        .where(DomainEvent.id > cursor)
                        .order_by(DomainEvent.id)
                        .limit(500)
                    )
                    .scalars()
                    .all()
                )
                return [publisher._serialize(row) for row in rows]

        async def stream():
            try:
                for item in await asyncio.to_thread(_replay):
                    yield f"id: {item['id']}\ndata: {json.dumps(item)}\n\n"
                if replay_only:
                    return
                while not await request.is_disconnected():
                    try:
                        item = await asyncio.wait_for(queue.get(), timeout=15.0)
                        yield f"id: {item['id']}\ndata: {json.dumps(item)}\n\n"
                    except TimeoutError:
                        yield ": keepalive\n\n"
            finally:
                publisher.unsubscribe(queue)

        return StreamingResponse(stream(), media_type="text/event-stream")

    from job_appli.web.onboarding import router as onboarding_router
    from job_appli.web.profile import router as profile_router
    from job_appli.web.resumes import router as resumes_router

    app.include_router(profile_router, prefix="/api")
    app.include_router(resumes_router, prefix="/api")
    app.include_router(onboarding_router, prefix="/api")

    if FRONTEND_DIST.exists():
        app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="spa")

    return app
