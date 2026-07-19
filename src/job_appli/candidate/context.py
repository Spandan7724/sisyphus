"""Selects the confirmed candidate evidence relevant to a task, within a budget."""

import sqlalchemy as sa
from pydantic import BaseModel
from sqlalchemy.orm import Session

from job_appli.candidate.models import (
    SENSITIVITY_NORMAL,
    CandidateFact,
    CandidateStory,
)


class ContextManifest(BaseModel):
    fact_ids: list[str]
    story_ids: list[str]
    truncated: bool


class CandidateContext(BaseModel):
    text: str
    manifest: ContextManifest


def _fact_line(fact: CandidateFact) -> str:
    value = fact.value.get("text", str(fact.value))
    return f"[{fact.id}] {fact.section}.{fact.key}: {value}"


def _story_block(story: CandidateStory) -> str:
    parts = [f"[{story.id}] STORY: {story.title}"]
    for label in ("context", "problem", "role", "actions", "result", "learned"):
        value = getattr(story, label)
        if value:
            parts.append(f"  {label}: {value}")
    if story.skills:
        parts.append(f"  skills: {', '.join(story.skills)}")
    return "\n".join(parts)


def build_context(
    session: Session,
    *,
    sections: list[str] | None = None,
    include_stories: bool = True,
    include_sensitive: bool = False,
    char_budget: int = 60000,
) -> CandidateContext:
    fact_query = (
        sa.select(CandidateFact)
        .where(
            CandidateFact.confirmed.is_(True),
            CandidateFact.superseded_by.is_(None),
            CandidateFact.reuse_permitted.is_(True),
        )
        .order_by(CandidateFact.section, CandidateFact.key)
    )
    if not include_sensitive:
        fact_query = fact_query.where(CandidateFact.sensitivity == SENSITIVITY_NORMAL)
    if sections:
        fact_query = fact_query.where(CandidateFact.section.in_(sections))
    facts = session.execute(fact_query).scalars().all()

    stories: list[CandidateStory] = []
    if include_stories:
        stories = (
            session.execute(
                sa.select(CandidateStory).where(CandidateStory.confirmed.is_(True))
            )
            .scalars()
            .all()
        )

    lines: list[str] = []
    fact_ids: list[str] = []
    story_ids: list[str] = []
    used = 0
    truncated = False

    for fact in facts:
        line = _fact_line(fact)
        if used + len(line) > char_budget:
            truncated = True
            break
        lines.append(line)
        fact_ids.append(fact.id)
        used += len(line) + 1

    for story in stories:
        block = _story_block(story)
        if used + len(block) > char_budget:
            truncated = True
            break
        lines.append(block)
        story_ids.append(story.id)
        used += len(block) + 1

    return CandidateContext(
        text="\n".join(lines),
        manifest=ContextManifest(
            fact_ids=fact_ids, story_ids=story_ids, truncated=truncated
        ),
    )
