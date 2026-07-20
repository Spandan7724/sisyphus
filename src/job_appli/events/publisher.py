"""Appends domain events and fans them out to live SSE subscribers."""

import asyncio
import threading
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from job_appli.db.models import DomainEvent


class EventPublisher:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def append(
        self,
        session: Session,
        *,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        actor: str,
        reason: str | None = None,
        payload: dict[str, Any] | None = None,
        workflow_id: str | None = None,
    ) -> DomainEvent:
        event = DomainEvent(
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            actor=actor,
            reason=reason,
            payload=payload,
            workflow_id=workflow_id,
        )
        session.add(event)
        session.flush()
        self._notify(self._serialize(event))
        return event

    def progress(
        self,
        *,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        actor: str,
        reason: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """Fan out an in-flight step to live subscribers without recording it.

        Progress is a UI signal, not a domain fact: it never reaches the event log,
        so replaying the stream still yields only what actually happened.
        """
        self._notify(
            {
                "id": 0,
                "transient": True,
                "event_type": event_type,
                "aggregate_type": aggregate_type,
                "aggregate_id": aggregate_id,
                "actor": actor,
                "reason": reason,
                "payload": payload,
                "workflow_id": None,
                "created_at": datetime.now(UTC).isoformat(),
            }
        )

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=500)
        with self._lock:
            self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        with self._lock:
            self._subscribers.discard(queue)

    @staticmethod
    def _serialize(event: DomainEvent) -> dict[str, Any]:
        return {
            "id": event.id,
            "event_type": event.event_type,
            "aggregate_type": event.aggregate_type,
            "aggregate_id": event.aggregate_id,
            "actor": event.actor,
            "reason": event.reason,
            "payload": event.payload,
            "workflow_id": event.workflow_id,
            "created_at": event.created_at.isoformat() if event.created_at else None,
        }

    def _notify(self, data: dict[str, Any]) -> None:
        if self._loop is None or self._loop.is_closed():
            return
        with self._lock:
            queues = list(self._subscribers)

        def _push() -> None:
            for queue in queues:
                try:
                    queue.put_nowait(data)
                except asyncio.QueueFull:
                    pass

        self._loop.call_soon_threadsafe(_push)


publisher = EventPublisher()
