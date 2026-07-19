"""Process entry point: starts the web server hosting the API, SSE stream, and SPA."""

import sys

import uvicorn

from job_appli.config import get_settings
from job_appli.web.app import create_app


def run() -> None:
    settings = get_settings()
    if "--reload" in sys.argv:
        uvicorn.run(
            "job_appli.web.app:create_app",
            factory=True,
            reload=True,
            reload_dirs=["src/job_appli"],
            host=settings.host,
            port=settings.port,
        )
    else:
        uvicorn.run(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()
