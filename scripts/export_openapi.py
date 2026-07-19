"""Prints the FastAPI OpenAPI schema as JSON for TypeScript client generation."""

import json

from job_appli.config import Settings
from job_appli.web.app import create_app

app = create_app(Settings(dbos_enabled=False))
print(json.dumps(app.openapi()))
