"""Resume ingestion: store the file, extract text, save the draft unconfirmed."""

from typing import Literal

from pydantic import BaseModel, Field

from job_appli.artifacts.store import ArtifactStore
from job_appli.candidate.extraction import extract_text
from job_appli.candidate.models import (
    SOURCE_RESUME,
    CandidateFact,
    CandidateStory,
    Resume,
)
from job_appli.db.base import Database
from job_appli.events.publisher import publisher
from job_appli.llm.prompts import load_prompt
from job_appli.llm.service import LLMService

Section = Literal[
    "identity",
    "contact",
    "eligibility",
    "employment",
    "education",
    "skills",
    "projects",
    "motivations",
    "interests",
    "logistics",
    "other",
]


class DraftFact(BaseModel):
    section: Section
    key: str
    value_text: str
    confidence: float = Field(ge=0, le=1)
    evidence_quote: str | None = None


class DraftStory(BaseModel):
    title: str
    context: str | None = None
    actions: str | None = None
    result: str | None = None
    skills: list[str] = []


class CandidateProfileDraft(BaseModel):
    facts: list[DraftFact]
    stories: list[DraftStory]


class IngestResult(BaseModel):
    resume_id: str
    artifact_id: str
    fact_count: int
    story_count: int


def ingest_resume(
    db: Database,
    artifacts: ArtifactStore,
    llm: LLMService,
    *,
    content: bytes,
    filename: str,
    make_default: bool = False,
) -> IngestResult:
    def step(name: str, detail: str) -> None:
        publisher.progress(
            event_type="resume.progress",
            aggregate_type="resume",
            aggregate_id="pending",
            actor="agent",
            reason=detail,
            payload={"step": name, "filename": filename},
        )

    step("reading", f"reading {filename}")
    text = extract_text(content, filename)

    step("interpreting", f"interpreting {len(text):,} characters of resume text")
    prompt = load_prompt("resume_interpret")
    draft = llm.run(
        "resume_extraction",
        output_type=CandidateProfileDraft,
        user_prompt=text,
        prompt=prompt,
    )

    step(
        "saving",
        f"drafting {len(draft.facts)} facts and {len(draft.stories)} stories",
    )
    with db.session() as session:
        artifact = artifacts.save(
            session, content=content, kind="resume", original_filename=filename
        )
        label = artifact.original_filename or "resume"
        resume = Resume(artifact_id=artifact.id, label=label)
        if make_default:
            for existing in session.query(Resume).filter_by(is_default=True):
                existing.is_default = False
            resume.is_default = True
        session.add(resume)
        session.flush()

        for fact in draft.facts:
            session.add(
                CandidateFact(
                    section=fact.section,
                    key=fact.key,
                    value={"text": fact.value_text},
                    source_type=SOURCE_RESUME,
                    source_artifact_id=artifact.id,
                    source_span=fact.evidence_quote,
                    confidence=fact.confidence,
                    confirmed=False,
                )
            )
        for story in draft.stories:
            session.add(
                CandidateStory(
                    title=story.title,
                    context=story.context,
                    actions=story.actions,
                    result=story.result,
                    skills=story.skills,
                    source_type=SOURCE_RESUME,
                    source_artifact_id=artifact.id,
                    confirmed=False,
                )
            )

        publisher.append(
            session,
            event_type="resume.ingested",
            aggregate_type="resume",
            aggregate_id=resume.id,
            actor="system",
            payload={"facts": len(draft.facts), "stories": len(draft.stories)},
        )
        return IngestResult(
            resume_id=resume.id,
            artifact_id=artifact.id,
            fact_count=len(draft.facts),
            story_count=len(draft.stories),
        )
