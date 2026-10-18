import asyncio
import json
import logging
import time
import uuid
from typing import AsyncGenerator, Dict, Set, Optional

logger = logging.getLogger(__name__)

class SSEBroadcaster:
    """
    In-memory Server-Sent Events (SSE) broadcaster with single-use ticket store
    compliant with PRD v2.5.2 Bab 8.2 (Endpoints 8 & 15).
    """
    def __init__(self):
        # candidate_id -> Set of asyncio.Queue
        self._listeners: Dict[int, Set[asyncio.Queue]] = {}
        # Stores recent trace buffer per candidate for immediate replay on client connect
        self._history: Dict[int, list] = {}
        self._lock = asyncio.Lock()
        # Single-use tickets: ticket_id -> {"candidate_id": int, "expires_at": float}
        self._tickets: Dict[str, dict] = {}
        self._ticket_ttl_seconds = 60

    async def issue_ticket(self, candidate_id: int) -> str:
        """
        Issues a single-use UUIDv4 ticket with TTL 60 seconds (PRD Bab 8.2 Endpoint 15).
        """
        ticket = str(uuid.uuid4())
        now = time.time()
        async with self._lock:
            # Purge expired tickets opportunistically
            expired_keys = [k for k, v in self._tickets.items() if v["expires_at"] < now]
            for k in expired_keys:
                del self._tickets[k]

            self._tickets[ticket] = {
                "candidate_id": candidate_id,
                "expires_at": now + self._ticket_ttl_seconds,
            }
        return ticket

    async def validate_and_burn_ticket(self, candidate_id: int, ticket: str) -> bool:
        """
        Validates single-use ticket and immediately burns it (burn-on-read).
        """
        now = time.time()
        async with self._lock:
            ticket_data = self._tickets.get(ticket)
            if not ticket_data:
                return False
            if ticket_data["expires_at"] < now:
                del self._tickets[ticket]
                return False
            if ticket_data["candidate_id"] != candidate_id:
                return False
            # Burn ticket on successful validation
            del self._tickets[ticket]
            return True

    async def subscribe(self, candidate_id: int) -> AsyncGenerator[dict, None]:
        queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            if candidate_id not in self._listeners:
                self._listeners[candidate_id] = set()
            self._listeners[candidate_id].add(queue)
            history_copy = list(self._history.get(candidate_id, []))

        # Replay past events
        for event in history_copy:
            yield event

        try:
            while True:
                # Wait for new event
                event = await queue.get()
                yield event
                queue.task_done()
                if event.get("event") in ("completed", "failed"):
                    break
        finally:
            async with self._lock:
                if candidate_id in self._listeners and queue in self._listeners[candidate_id]:
                    self._listeners[candidate_id].remove(queue)
                    if not self._listeners[candidate_id]:
                        del self._listeners[candidate_id]

    async def publish(self, candidate_id: int, step_name: str, status: str, details: dict | None = None):
        event_data = {
            "candidate_id": candidate_id,
            "step": step_name,
            "status": status,
            "details": details or {},
        }
        async with self._lock:
            if candidate_id not in self._history:
                self._history[candidate_id] = []
            self._history[candidate_id].append(event_data)
            listeners = list(self._listeners.get(candidate_id, []))

        for q in listeners:
            try:
                q.put_nowait(event_data)
            except asyncio.QueueFull:
                logger.warning(f"Queue full for listener on candidate {candidate_id}")

    def clear_history(self, candidate_id: int):
        if candidate_id in self._history:
            del self._history[candidate_id]

sse_broadcaster = SSEBroadcaster()
