"""Onboarding API: checklist + LLM-generated questions, answers, skips."""

import asyncio
from typing import Any

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from job_appli.candidate.interview import (
    CHECKLIST,
    SKIP_MARKER,
    generate_questions,
    pending_generated,
    pending_questions,
)
from job_appli.candidate.models import (
    SOURCE_ONBOARDING,
    CandidateFact,
    InterviewQuestionRecord,
)
from job_appli.events.publisher import publisher

router = APIRouter(tags=["onboarding"])


class QuestionOut(BaseModel):
    section: str
    key: str
    question: str
    sensitivity: str = "normal"
    optional: bool
    origin: str
    rationale: str | None = None


class AnswerIn(BaseModel):
    section: str
    key: str
    value: dict[str, Any] | None = None
    skip: bool = False


def _merged_pending(session) -> list[QuestionOut]:
    out = [
        QuestionOut(
            section=q.section,
            key=q.key,
            question=q.question,
            sensitivity=q.sensitivity,
            optional=q.optional,
            origin="checklist",
        )
        for q in pending_questions(session)
    ]
    out.extend(
        QuestionOut(
            section=r.section,
            key=r.key,
            question=r.question,
            optional=True,
            origin="generated",
            rationale=r.rationale,
        )
        for r in pending_generated(session)
    )
    return out


@router.get("/onboarding/next", response_model=list[QuestionOut])
def next_questions(request: Request, limit: int = 5):
    with request.app.state.db.session() as session:
        return _merged_pending(session)[:limit]


@router.post("/onboarding/generate", response_model=list[QuestionOut])
async def generate(request: Request):
    db = request.app.state.db
    llm = request.app.state.llm

    def _run():
        with db.session() as session:
            stored = generate_questions(session, llm)
            for record in stored:
                publisher.append(
                    session,
                    event_type="onboarding.question_generated",
                    aggregate_type="interview_question",
                    aggregate_id=record.id,
                    actor="agent",
                    reason=record.rationale,
                )
            return [
                QuestionOut(
                    section=r.section,
                    key=r.key,
                    question=r.question,
                    optional=True,
                    origin="generated",
                    rationale=r.rationale,
                )
                for r in stored
            ]

    return await asyncio.to_thread(_run)


@router.post("/onboarding/answer")
def answer(request: Request, body: AnswerIn):
    checklist_q = next(
        (q for q in CHECKLIST if (q.section, q.key) == (body.section, body.key)), None
    )
    with request.app.state.db.session() as session:
        generated_q = None
        if checklist_q is None:
            generated_q = session.execute(
                sa.select(InterviewQuestionRecord).where(
                    InterviewQuestionRecord.section == body.section,
                    InterviewQuestionRecord.key == body.key,
                    InterviewQuestionRecord.status == "pending",
                )
            ).scalar_one_or_none()
            if generated_q is None:
                raise HTTPException(404, "unknown question")

        optional = checklist_q.optional if checklist_q else True
        sensitivity = checklist_q.sensitivity if checklist_q else "normal"
        if body.skip and not optional:
            raise HTTPException(400, "this question is required and cannot be skipped")
        if not body.skip and not body.value:
            raise HTTPException(400, "value required unless skipping")

        if generated_q is not None:
            generated_q.status = "dismissed" if body.skip else "answered"
        if body.skip and generated_q is not None:
            remaining = len(_merged_pending(session))
            return {"fact_id": None, "remaining": remaining}

        fact = CandidateFact(
            section=body.section,
            key=body.key,
            value={"text": SKIP_MARKER} if body.skip else body.value,
            source_type=SOURCE_ONBOARDING,
            sensitivity=sensitivity,
            reuse_permitted=not body.skip,
            confirmed=True,
        )
        session.add(fact)
        session.flush()
        publisher.append(
            session,
            event_type="onboarding.skipped" if body.skip else "onboarding.answered",
            aggregate_type="candidate_fact",
            aggregate_id=fact.id,
            actor="user",
        )
        remaining = len(_merged_pending(session))
        return {"fact_id": fact.id, "remaining": remaining}
