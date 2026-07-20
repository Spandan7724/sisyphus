"""Application service for search-preference state changes and audit events."""

import sqlalchemy as sa
from sqlalchemy.orm import Session

from job_appli.db.base import Database
from job_appli.events.publisher import publisher
from job_appli.preferences.models import SearchPreference, SearchPreferenceSet


class PreferenceNotFoundError(Exception):
    pass


class DuplicatePreferenceError(Exception):
    pass


class PreferenceService:
    def __init__(self, db: Database) -> None:
        self.db = db

    def list(self) -> list[SearchPreference]:
        with self.db.session() as session:
            return list(
                session.execute(
                    sa.select(SearchPreference)
                    .join(SearchPreferenceSet)
                    .where(SearchPreferenceSet.is_active.is_(True))
                    .order_by(
                        SearchPreference.strength,
                        SearchPreference.category,
                        SearchPreference.created_at,
                    )
                ).scalars()
            )

    def create(
        self,
        *,
        strength: str,
        category: str,
        operator: str,
        values: list[str],
        enabled: bool,
    ) -> SearchPreference:
        with self.db.session() as session:
            preference_set = self._active_set(session)
            self._ensure_unique(
                session,
                preference_set.id,
                strength,
                category,
                operator,
            )
            rule = SearchPreference(
                preference_set_id=preference_set.id,
                strength=strength,
                category=category,
                operator=operator,
                values=values,
                enabled=enabled,
            )
            session.add(rule)
            session.flush()
            publisher.append(
                session,
                event_type="preferences.rule.created",
                aggregate_type="search_preference",
                aggregate_id=rule.id,
                actor="user",
                reason="preference_rule_created",
                payload={
                    "strength": strength,
                    "category": category,
                    "operator": operator,
                },
            )
            return rule

    def update(
        self,
        rule_id: str,
        *,
        strength: str,
        category: str,
        operator: str,
        values: list[str],
        enabled: bool,
    ) -> SearchPreference:
        with self.db.session() as session:
            rule = session.get(SearchPreference, rule_id)
            if rule is None:
                raise PreferenceNotFoundError
            self._ensure_unique(
                session,
                rule.preference_set_id,
                strength,
                category,
                operator,
                exclude_id=rule.id,
            )
            rule.strength = strength
            rule.category = category
            rule.operator = operator
            rule.values = values
            rule.enabled = enabled
            session.flush()
            publisher.append(
                session,
                event_type="preferences.rule.updated",
                aggregate_type="search_preference",
                aggregate_id=rule.id,
                actor="user",
                reason="preference_rule_updated",
                payload={
                    "strength": strength,
                    "category": category,
                    "operator": operator,
                    "enabled": enabled,
                },
            )
            return rule

    def delete(self, rule_id: str) -> None:
        with self.db.session() as session:
            rule = session.get(SearchPreference, rule_id)
            if rule is None:
                raise PreferenceNotFoundError
            session.delete(rule)
            publisher.append(
                session,
                event_type="preferences.rule.deleted",
                aggregate_type="search_preference",
                aggregate_id=rule.id,
                actor="user",
                reason="preference_rule_deleted",
                payload={"strength": rule.strength, "category": rule.category},
            )

    @staticmethod
    def _active_set(session: Session) -> SearchPreferenceSet:
        preference_set = session.execute(
            sa.select(SearchPreferenceSet)
            .where(SearchPreferenceSet.is_active.is_(True))
            .order_by(SearchPreferenceSet.created_at)
        ).scalar_one_or_none()
        if preference_set is None:
            preference_set = SearchPreferenceSet()
            session.add(preference_set)
            session.flush()
        return preference_set

    @staticmethod
    def _ensure_unique(
        session: Session,
        preference_set_id: str,
        strength: str,
        category: str,
        operator: str,
        *,
        exclude_id: str | None = None,
    ) -> None:
        query = sa.select(SearchPreference.id).where(
            SearchPreference.preference_set_id == preference_set_id,
            SearchPreference.strength == strength,
            SearchPreference.category == category,
            SearchPreference.operator == operator,
        )
        if exclude_id is not None:
            query = query.where(SearchPreference.id != exclude_id)
        if session.execute(query).scalar_one_or_none() is not None:
            raise DuplicatePreferenceError
