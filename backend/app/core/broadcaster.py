"""
Server-Sent Events broadcaster with Redis pub/sub for multi-worker deployments.

Contract (unchanged from the original in-memory version, PRD v2.5.2 Bab 8.2
Endpoints 8 & 15):
  - `issue_ticket` / `validate_and_burn_ticket`: single-use, 60s TTL, burn-on-read
  - `subscribe`: async generator replaying buffered history then live events,
    terminating on a terminal ("completed"/"failed") event
  - `publish`: append to replay buffer and fan out to live listeners

Storage selection:
  - Redis available -> tickets and event history live in Redis, fan-out goes
    through pub/sub so a ticket issued on worker A is honoured on worker B.
  - Redis absent    -> original in-process asyncio.Queue behaviour.

Redis keys (namespaced by REDIS_KEY_PREFIX):
  talentops:sse:ticket:<uuid>      -> JSON {candidate_id, expires_at}   TTL 60s
  talentops:sse:history:<cid>      -> LIST of JSON events               capped
  talentops:sse:channel:<cid>      -> pub/sub channel of JSON events
"""
import asyncio
import json
import logging
import time
import uuid
from typing import AsyncGenerator, Dict, List, Optional, Set

from app.core.config import settings
from app.core.state import key, redis_state

logger = logging.getLogger(__name__)

TERMINAL_EVENTS = ("completed", "failed")

INTERMEDIATE_TRIAGE_STEPS = {
    "triage_initiated",
    "pii_sanitization",
    "hidden_text_audit",
    "docx_integrity",
    "llm_extraction",
    "substring_guard_audit",
    "substring_guard",
    "github_repo_verification",
    "github_audit",
    "deterministic_scoring",
}


class SSEBroadcaster:
    """
    Multi-worker-safe SSE broadcaster.

    The in-memory maps below are still used as the fallback path, so behaviour on a
    single Uvicorn worker without Redis is byte-for-byte the previous implementation.
    """

    def __init__(self) -> None:
        # Fallback state (Redis absent)
        self._listeners: Dict[int, Set[asyncio.Queue]] = {}
        self._history: Dict[int, List[dict]] = {}
        self._tickets: Dict[str, dict] = {}
        self._lock = asyncio.Lock()
        self._ticket_ttl_seconds = 60

    # -- tickets ------------------------------------------------------------

    async def issue_ticket(self, candidate_id: int) -> str:
        """Issues a single-use UUIDv4 ticket with TTL 60s (PRD Bab 8.2 Endpoint 15)."""
        ticket = str(uuid.uuid4())
        now = time.time()
        client = await redis_state.client()

        if client is not None:
            payload = json.dumps({"candidate_id": candidate_id, "expires_at": now + self._ticket_ttl_seconds})
            await client.set(key("sse", "ticket", ticket), payload, ex=self._ticket_ttl_seconds)
            return ticket

        async with self._lock:
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
        Validates a single-use ticket and burns it atomically (burn-on-read).

        Redis mode uses GETDEL so two concurrent workers cannot both redeem the
        same ticket — a plain GET+DEL pair would race.
        """
        now = time.time()
        client = await redis_state.client()

        if client is not None:
            redis_key = key("sse", "ticket", ticket)
            try:
                raw = await client.get(redis_key)
            except Exception as exc:
                logger.warning("Redis ticket lookup failed: %s", exc)
                return False
            if raw is None:
                return False
            try:
                data = json.loads(raw)
            except Exception:
                return False
            # Do NOT burn on a mismatched candidate: otherwise anyone who learns a
            # ticket string could invalidate the legitimate holder's stream.
            if data.get("expires_at", 0) < now:
                return False
            if data.get("candidate_id") != candidate_id:
                return False
            # Burn atomically; if another worker already redeemed it, GETDEL returns
            # a different payload (or None) and this caller loses the race.
            try:
                burned = await client.getdel(redis_key)
            except Exception:
                burned = await client.get(redis_key)
                if burned is not None:
                    await client.delete(redis_key)
            return burned == raw

        async with self._lock:
            ticket_data = self._tickets.get(ticket)
            if not ticket_data:
                return False
            if ticket_data["expires_at"] < now:
                del self._tickets[ticket]
                return False
            if ticket_data["candidate_id"] != candidate_id:
                return False
            del self._tickets[ticket]
            return True

    # -- subscription -------------------------------------------------------

    async def subscribe(self, candidate_id: int) -> AsyncGenerator[dict, None]:
        client = await redis_state.client()
        if client is not None:
            async for event in self._subscribe_redis(candidate_id, client):
                yield event
            return

        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._listeners.setdefault(candidate_id, set()).add(queue)
            history_copy = list(self._history.get(candidate_id, []))

        for event in history_copy:
            yield event
            if event.get("event") in TERMINAL_EVENTS:
                return

        try:
            while True:
                event = await queue.get()
                yield event
                queue.task_done()
                if event.get("event") in TERMINAL_EVENTS:
                    break
        finally:
            async with self._lock:
                if candidate_id in self._listeners and queue in self._listeners[candidate_id]:
                    self._listeners[candidate_id].remove(queue)
                    if not self._listeners[candidate_id]:
                        del self._listeners[candidate_id]

    async def _subscribe_redis(self, candidate_id: int, client) -> AsyncGenerator[dict, None]:
        pubsub = client.pubsub()
        channel = key("sse", "channel", candidate_id)
        history_key = key("sse", "history", candidate_id)
        await pubsub.subscribe(channel)
        try:
            # Replay buffered history before streaming live events.
            try:
                raw_history = await client.lrange(history_key, 0, -1)
            except Exception:
                raw_history = []
            for raw in raw_history:
                try:
                    event = json.loads(raw)
                except Exception:
                    continue
                yield event
                if event.get("event") in TERMINAL_EVENTS:
                    return

            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message is None:
                    continue
                data = message.get("data")
                if data is None:
                    continue
                try:
                    event = json.loads(data)
                except Exception:
                    continue
                yield event
                if event.get("event") in TERMINAL_EVENTS:
                    return
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()
            except Exception:
                pass

    # -- publishing ---------------------------------------------------------

    async def publish(
        self,
        candidate_id: int,
        step_name: str,
        status: str,
        details: Optional[dict] = None,
        is_terminal: Optional[bool] = None,
    ) -> None:
        if is_terminal is None:
            if step_name in INTERMEDIATE_TRIAGE_STEPS:
                is_terminal = False
            elif step_name in ("triage_completed", "agent_decision", "triage_failed") or status in ("failed", "error"):
                is_terminal = True
            else:
                is_terminal = status in TERMINAL_EVENTS

        event_data = {
            "candidate_id": candidate_id,
            "step": step_name,
            "status": status,
            "details": details or {},
            "event": status if is_terminal else "progress",
        }

        client = await redis_state.client()
        if client is not None:
            history_key = key("sse", "history", candidate_id)
            channel = key("sse", "channel", candidate_id)
            payload = json.dumps(event_data)
            try:
                pipe = client.pipeline()
                pipe.rpush(history_key, payload)
                pipe.ltrim(history_key, -settings.SSE_HISTORY_MAX_EVENTS, -1)
                pipe.expire(history_key, 3600)
                pipe.publish(channel, payload)
                await pipe.execute()
            except Exception as exc:
                logger.warning("Redis SSE publish failed for candidate %s: %s", candidate_id, exc)
            return

        async with self._lock:
            self._history.setdefault(candidate_id, []).append(event_data)
            listeners = list(self._listeners.get(candidate_id, []))

        for q in listeners:
            try:
                q.put_nowait(event_data)
            except asyncio.QueueFull:
                logger.warning("Queue full for listener on candidate %s", candidate_id)

    # -- maintenance --------------------------------------------------------

    async def clear_history(self, candidate_id: int) -> None:
        client = await redis_state.client()
        if client is not None:
            try:
                await client.delete(key("sse", "history", candidate_id))
            except Exception:
                pass
            return
        self._history.pop(candidate_id, None)

    async def backend_name(self) -> str:
        """Diagnostic helper surfaced by /api/health."""
        return "redis" if await redis_state.client() is not None else "in-memory"


sse_broadcaster = SSEBroadcaster()
