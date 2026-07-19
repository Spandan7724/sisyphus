"""Adaptive onboarding: asks only the questions the profile has not answered."""

import sqlalchemy as sa
from pydantic import BaseModel
from sqlalchemy.orm import Session

from job_appli.candidate.models import (
    SENSITIVITY_LEGAL,
    SENSITIVITY_NORMAL,
    SENSITIVITY_SENSITIVE,
    CandidateFact,
    CandidateStory,
    InterviewQuestionRecord,
)
from job_appli.llm.prompts import load_prompt


class InterviewQuestion(BaseModel):
    section: str
    key: str
    question: str
    sensitivity: str = SENSITIVITY_NORMAL
    optional: bool = False


CHECKLIST: list[InterviewQuestion] = [
    InterviewQuestion(
        section="contact",
        key="email",
        question="What email should applications use?",
    ),
    InterviewQuestion(
        section="contact",
        key="phone",
        question="What phone number should applications use?",
    ),
    InterviewQuestion(
        section="contact",
        key="location",
        question="What is your current city and country?",
    ),
    InterviewQuestion(
        section="eligibility",
        key="work_authorization",
        question="Which countries are you legally authorized to work in?",
        sensitivity=SENSITIVITY_LEGAL,
    ),
    InterviewQuestion(
        section="eligibility",
        key="sponsorship",
        question="Do you now or will you in the future require visa sponsorship?",
        sensitivity=SENSITIVITY_LEGAL,
    ),
    InterviewQuestion(
        section="logistics",
        key="notice_period",
        question="What is your notice period or earliest start date?",
    ),
    InterviewQuestion(
        section="logistics",
        key="compensation_expectation",
        question=(
            "What are your compensation expectations, and how should they be phrased?"
        ),
    ),
    InterviewQuestion(
        section="logistics",
        key="relocation",
        question="Are you willing to relocate, and where?",
    ),
    InterviewQuestion(
        section="logistics",
        key="workplace_preference",
        question="Do you prefer remote, hybrid, or onsite work?",
    ),
    InterviewQuestion(
        section="motivations",
        key="career_goals",
        question=(
            "What roles are you targeting, and what are you looking"
            " for in your next move?"
        ),
    ),
    InterviewQuestion(
        section="interests",
        key="outside_work",
        question="What do you enjoy outside work that you'd be comfortable mentioning?",
        optional=True,
    ),
    InterviewQuestion(
        section="writing",
        key="voice_preferences",
        question="How should written answers sound (tone, length, anything to avoid)?",
        optional=True,
    ),
    InterviewQuestion(
        section="sensitive",
        key="demographic_policy",
        question=(
            "Optional: set standing answers for voluntary demographic questions "
            "(gender, race/ethnicity, disability, veteran status), or choose "
            "'prefer not to disclose'. These are never inferred."
        ),
        sensitivity=SENSITIVITY_SENSITIVE,
        optional=True,
    ),
]

SKIP_MARKER = "__skipped__"


class ProposedQuestion(BaseModel):
    section: str
    key: str
    question: str
    rationale: str


class ProposedQuestions(BaseModel):
    questions: list[ProposedQuestion]


STORY_FIELDS = ("context", "problem", "role", "actions", "result", "learned")
BANNED_TERMS = ("gender", "race", "ethnic", "disability", "veteran", "health")


def profile_snapshot(session: Session) -> str:
    lines = ["## Facts (state=confirmed|draft, confidence)"]
    facts = session.execute(
        sa.select(CandidateFact)
        .where(CandidateFact.superseded_by.is_(None))
        .order_by(CandidateFact.section, CandidateFact.key)
    ).scalars()
    for f in facts:
        state = "confirmed" if f.confirmed else "draft"
        value = str(f.value.get("text", f.value))[:120]
        lines.append(f"- {f.section}.{f.key} ({state}, conf={f.confidence}): {value}")
    lines.append("## Stories (with any empty fields listed)")
    for s in session.execute(sa.select(CandidateStory)).scalars():
        missing = [name for name in STORY_FIELDS if not getattr(s, name)]
        state = "confirmed" if s.confirmed else "draft"
        lines.append(f"- {s.title} ({state}; missing: {', '.join(missing) or 'none'})")
    return "\n".join(lines)


def generate_questions(session: Session, llm) -> list[InterviewQuestionRecord]:
    proposal = llm.run(
        "onboarding_interview",
        output_type=ProposedQuestions,
        user_prompt=profile_snapshot(session),
        prompt=load_prompt("onboarding_interview"),
    )

    taken = answered_keys(session)
    taken |= {(q.section, q.key) for q in CHECKLIST}
    taken |= set(
        session.execute(
            sa.select(InterviewQuestionRecord.section, InterviewQuestionRecord.key)
        ).all()
    )

    stored: list[InterviewQuestionRecord] = []
    for q in proposal.questions[:5]:
        text = f"{q.question} {q.rationale}".lower()
        if (q.section, q.key) in taken:
            continue
        if any(term in text for term in BANNED_TERMS):
            continue
        record = InterviewQuestionRecord(
            section=q.section, key=q.key, question=q.question, rationale=q.rationale
        )
        session.add(record)
        stored.append(record)
    session.flush()
    return stored


def pending_generated(session: Session) -> list[InterviewQuestionRecord]:
    done = answered_keys(session)
    records = session.execute(
        sa.select(InterviewQuestionRecord)
        .where(InterviewQuestionRecord.status == "pending")
        .order_by(InterviewQuestionRecord.created_at)
    ).scalars()
    return [r for r in records if (r.section, r.key) not in done]


def answered_keys(session: Session) -> set[tuple[str, str]]:
    rows = session.execute(
        sa.select(CandidateFact.section, CandidateFact.key).where(
            CandidateFact.confirmed.is_(True),
            CandidateFact.superseded_by.is_(None),
        )
    )
    return {(section, key) for section, key in rows}


def pending_questions(session: Session) -> list[InterviewQuestion]:
    done = answered_keys(session)
    return [q for q in CHECKLIST if (q.section, q.key) not in done]
