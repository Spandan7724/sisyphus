"""Search preference API with validated hard and soft rule contracts."""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from job_appli.preferences.service import (
    DuplicatePreferenceError,
    PreferenceNotFoundError,
    PreferenceService,
)

router = APIRouter(tags=["preferences"])

PreferenceStrength = Literal["hard", "soft"]
PreferenceCategory = Literal[
    "location",
    "work_arrangement",
    "work_authorization",
    "compensation",
    "employment_type",
    "company",
    "industry",
    "role",
    "seniority",
    "technology",
    "growth",
    "work_environment",
]
PreferenceOperator = Literal[
    "allow_any",
    "require_all",
    "exclude",
    "minimum",
    "maximum",
    "prefer",
    "avoid",
]
PreferenceValue = Annotated[str, Field(min_length=1, max_length=200)]

HARD_OPERATORS = {"allow_any", "require_all", "exclude", "minimum", "maximum"}
SOFT_OPERATORS = {"prefer", "avoid"}


class PreferenceRuleIn(BaseModel):
    strength: PreferenceStrength
    category: PreferenceCategory
    operator: PreferenceOperator
    values: list[PreferenceValue] = Field(min_length=1, max_length=25)
    enabled: bool = True

    @field_validator("values")
    @classmethod
    def normalize_values(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            clean = " ".join(value.split())
            folded = clean.casefold()
            if clean and folded not in seen:
                normalized.append(clean)
                seen.add(folded)
        if not normalized:
            raise ValueError("at least one non-empty value is required")
        return normalized

    @model_validator(mode="after")
    def validate_operator(self):
        allowed = HARD_OPERATORS if self.strength == "hard" else SOFT_OPERATORS
        if self.operator not in allowed:
            raise ValueError(f"{self.operator} is not valid for {self.strength} rules")
        if self.operator in {"minimum", "maximum"} and len(self.values) != 1:
            raise ValueError(f"{self.operator} rules require exactly one value")
        return self


class PreferenceRuleOut(PreferenceRuleIn):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.get("/preferences", response_model=list[PreferenceRuleOut])
def list_preferences(request: Request):
    return [
        PreferenceRuleOut.model_validate(rule)
        for rule in PreferenceService(request.app.state.db).list()
    ]


@router.post("/preferences", response_model=PreferenceRuleOut, status_code=201)
def create_preference(request: Request, body: PreferenceRuleIn):
    try:
        rule = PreferenceService(request.app.state.db).create(**body.model_dump())
    except DuplicatePreferenceError:
        raise HTTPException(
            409, "a rule already exists for this category and operator"
        ) from None
    return PreferenceRuleOut.model_validate(rule)


@router.put("/preferences/{rule_id}", response_model=PreferenceRuleOut)
def update_preference(request: Request, rule_id: str, body: PreferenceRuleIn):
    try:
        rule = PreferenceService(request.app.state.db).update(
            rule_id, **body.model_dump()
        )
    except PreferenceNotFoundError:
        raise HTTPException(404, "preference rule not found") from None
    except DuplicatePreferenceError:
        raise HTTPException(
            409, "a rule already exists for this category and operator"
        ) from None
    return PreferenceRuleOut.model_validate(rule)


@router.delete("/preferences/{rule_id}")
def delete_preference(request: Request, rule_id: str):
    try:
        PreferenceService(request.app.state.db).delete(rule_id)
    except PreferenceNotFoundError:
        raise HTTPException(404, "preference rule not found") from None
    return {"deleted": rule_id}
