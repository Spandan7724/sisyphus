"""Ingestion tests: corpus extraction, draft provenance, upload API."""

from pathlib import Path

import pytest

from job_appli.candidate.extraction import ExtractionTooSparse, extract_text
from job_appli.candidate.ingestion import (
    CandidateProfileDraft,
    DraftFact,
    DraftStory,
    IngestResult,
    ingest_resume,
)

CORPUS = Path(__file__).parents[1] / "sample_resume"

DRAFT = CandidateProfileDraft(
    facts=[
        DraftFact(
            section="identity",
            key="full_name",
            value_text="Spandan Chavan",
            confidence=0.98,
            evidence_quote="Spandan Chavan",
        ),
        DraftFact(
            section="skills", key="skills.1", value_text="Python", confidence=0.9
        ),
    ],
    stories=[DraftStory(title="Built a durable agent", skills=["python"])],
)


class StubLLM:
    def run(self, task, **kwargs):
        assert task == "resume_extraction"
        assert kwargs["prompt"].ref == "resume_interpret"
        return DRAFT


@pytest.fixture
def pdf_bytes() -> bytes:
    return (CORPUS / "computer_science_resume.pdf").read_bytes()


def test_extract_text_real_corpus(pdf_bytes):
    text = extract_text(pdf_bytes, "resume.pdf")
    assert len(text) > 1000
    docx_file = CORPUS / "computer_science_resume.docx"
    assert len(extract_text(docx_file.read_bytes(), docx_file.name)) > 1000


def test_extract_rejects_unsupported_and_sparse():
    with pytest.raises(ValueError):
        extract_text(b"x", "resume.txt")
    import fitz

    empty = fitz.open()
    empty.new_page()
    with pytest.raises(ExtractionTooSparse):
        extract_text(empty.tobytes(), "empty.pdf")


def test_ingest_stores_unconfirmed_draft_with_provenance(settings, db, pdf_bytes):
    from job_appli.artifacts.store import ArtifactStore

    result = ingest_resume(
        db,
        ArtifactStore(settings.artifacts_dir),
        StubLLM(),
        content=pdf_bytes,
        filename="cv.pdf",
        make_default=True,
    )
    assert isinstance(result, IngestResult)
    assert (result.fact_count, result.story_count) == (2, 1)

    import sqlalchemy as sa

    from job_appli.candidate.models import CandidateFact, Resume

    with db.session() as session:
        facts = session.execute(sa.select(CandidateFact)).scalars().all()
        assert all(not f.confirmed for f in facts)
        assert all(f.source_type == "resume" for f in facts)
        named = next(f for f in facts if f.key == "full_name")
        assert named.source_artifact_id == result.artifact_id
        assert named.source_span == "Spandan Chavan"
        resume = session.get(Resume, result.resume_id)
        assert resume.is_default


def test_upload_endpoint(client, pdf_bytes):
    client.app.state.llm = StubLLM()
    response = client.post("/api/resumes", files={"file": ("cv.pdf", pdf_bytes)})
    assert response.status_code == 200
    body = response.json()
    assert body["fact_count"] == 2

    draft = client.get(f"/api/resumes/{body['resume_id']}/draft").json()
    assert len(draft["facts"]) == 2
    assert draft["facts"][0]["confirmed"] is False

    listed = client.get("/api/resumes").json()
    assert listed[0]["is_default"] is True
