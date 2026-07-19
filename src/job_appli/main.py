"""Process entry point: starts the web server hosting the API, SSE stream, and SPA."""

import uvicorn

from job_appli.config import get_settings
from job_appli.web.app import create_app


def run() -> None:
    settings = get_settings()
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()
