"""Resume API: upload, ingest, and list resumes with draft review data."""

import asyncio

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Request, UploadFile

from job_appli.candidate.extraction import ExtractionTooSparse
from job_appli.candidate.ingestion import IngestResult, ingest_resume
from job_appli.candidate.models import CandidateFact, CandidateStory, Resume

router = APIRouter(tags=["resumes"])


@router.post("/resumes", response_model=IngestResult)
async def upload_resume(request: Request, file: UploadFile, make_default: bool = True):
    content = await file.read()
    if not content:
        raise HTTPException(400, "empty file")
    try:
        return await asyncio.to_thread(
            ingest_resume,
            request.app.state.db,
            request.app.state.artifacts,
            request.app.state.llm,
            content=content,
            filename=file.filename or "resume",
            make_default=make_default,
        )
    except ExtractionTooSparse as exc:
        raise HTTPException(422, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(415, str(exc)) from exc


@router.get("/resumes")
def list_resumes(request: Request):
    with request.app.state.db.session() as session:
        rows = session.execute(sa.select(Resume).order_by(Resume.created_at)).scalars()
        return [
            {
                "id": r.id,
                "label": r.label,
                "is_default": r.is_default,
                "artifact_id": r.artifact_id,
            }
            for r in rows
        ]


@router.get("/resumes/{resume_id}/draft")
def resume_draft(request: Request, resume_id: str):
    with request.app.state.db.session() as session:
        resume = session.get(Resume, resume_id)
        if resume is None:
            raise HTTPException(404, "resume not found")
        facts = (
            session.execute(
                sa.select(CandidateFact)
                .where(CandidateFact.source_artifact_id == resume.artifact_id)
                .order_by(CandidateFact.section, CandidateFact.key)
            )
            .scalars()
            .all()
        )
        stories = (
            session.execute(
                sa.select(CandidateStory).where(
                    CandidateStory.source_artifact_id == resume.artifact_id
                )
            )
            .scalars()
            .all()
        )
        return {
            "facts": [
                {
                    "id": f.id,
                    "section": f.section,
                    "key": f.key,
                    "value": f.value,
                    "confidence": f.confidence,
                    "confirmed": f.confirmed,
                    "evidence": f.source_span,
                }
                for f in facts
            ],
            "stories": [
                {"id": s.id, "title": s.title, "confirmed": s.confirmed}
                for s in stories
            ],
        }
