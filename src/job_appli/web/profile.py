"""Candidate profile API: fact CRUD with supersede-on-update semantics."""

from typing import Any

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from job_appli.candidate.models import SENSITIVITY_NORMAL, SOURCE_MANUAL, CandidateFact
from job_appli.events.publisher import publisher

router = APIRouter(tags=["profile"])


class FactIn(BaseModel):
    section: str
    key: str
    value: dict[str, Any]
    sensitivity: str = SENSITIVITY_NORMAL
    reuse_permitted: bool = True


class FactOut(FactIn):
    id: str
    source_type: str
    confidence: float | None
    confirmed: bool

    model_config = {"from_attributes": True}


@router.get("/profile/facts", response_model=list[FactOut])
def list_facts(request: Request, section: str | None = None):
    db = request.app.state.db
    with db.session() as session:
        query = (
            sa.select(CandidateFact)
            .where(CandidateFact.superseded_by.is_(None))
            .order_by(CandidateFact.section, CandidateFact.key)
        )
        if section:
            query = query.where(CandidateFact.section == section)
        return [FactOut.model_validate(f) for f in session.execute(query).scalars()]


@router.post("/profile/facts", response_model=FactOut)
def create_fact(request: Request, body: FactIn):
    db = request.app.state.db
    with db.session() as session:
        fact = CandidateFact(
            section=body.section,
            key=body.key,
            value=body.value,
            sensitivity=body.sensitivity,
            reuse_permitted=body.reuse_permitted,
            source_type=SOURCE_MANUAL,
            confirmed=True,
        )
        session.add(fact)
        session.flush()
        publisher.append(
            session,
            event_type="profile.fact.created",
            aggregate_type="candidate_fact",
            aggregate_id=fact.id,
            actor="user",
        )
        return FactOut.model_validate(fact)


@router.put("/profile/facts/{fact_id}", response_model=FactOut)
def update_fact(request: Request, fact_id: str, body: FactIn):
    db = request.app.state.db
    with db.session() as session:
        old = session.get(CandidateFact, fact_id)
        if old is None or old.superseded_by is not None:
            raise HTTPException(404, "fact not found or already superseded")
        new = CandidateFact(
            section=body.section,
            key=body.key,
            value=body.value,
            sensitivity=body.sensitivity,
            reuse_permitted=body.reuse_permitted,
            source_type=SOURCE_MANUAL,
            confirmed=True,
        )
        session.add(new)
        session.flush()
        old.superseded_by = new.id
        publisher.append(
            session,
            event_type="profile.fact.updated",
            aggregate_type="candidate_fact",
            aggregate_id=new.id,
            actor="user",
            payload={"superseded": old.id},
        )
        return FactOut.model_validate(new)


@router.delete("/profile/facts/{fact_id}")
def delete_fact(request: Request, fact_id: str):
    db = request.app.state.db
    with db.session() as session:
        fact = session.get(CandidateFact, fact_id)
        if fact is None:
            raise HTTPException(404, "fact not found")
        session.delete(fact)
        publisher.append(
            session,
            event_type="profile.fact.deleted",
            aggregate_type="candidate_fact",
            aggregate_id=fact_id,
            actor="user",
        )
        return {"deleted": fact_id}
