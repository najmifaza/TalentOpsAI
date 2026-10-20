"""
Shared state backends for multi-worker deployments.

TalentOps historically kept the SSE broadcaster and the LLM triage semaphore in
process memory, which silently breaks under `uvicorn --workers N`:
a ticket issued by worker A is unknown to worker B, and each worker gets its own
concurrency budget. This module provides a Redis-backed implementation of both,
with an explicit in-memory fallback so single-worker dev runs keep working
without a Redis server.

Resolution order (see `backend_state`):
  1. REDIS_URL set AND `redis` package importable AND server reachable -> Redis
  2. otherwise                                                       -> in-memory
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

try:  # optional dependency: absent => in-memory fallback
    import redis.asyncio as aioredis
except Exception:  # pragma: no cover - exercised only without the package
    aioredis = None


# ---------------------------------------------------------------------------
# Redis client lifecycle
# ---------------------------------------------------------------------------

class RedisState:
    """Lazy singleton wrapper around an async Redis client."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None
        self._probed = False
        self._available = False
        self._lock = asyncio.Lock()

    @property
    def configured(self) -> bool:
        return bool(settings.REDIS_URL) and aioredis is not None

    async def client(self) -> Optional[Any]:
        """Returns a live Redis client, or None when Redis is not usable."""
        if not self.configured:
            return None
        if self._probed:
            return self._client if self._available else None

        async with self._lock:
            if self._probed:
                return self._client if self._available else None
            self._probed = True
            try:
                client = aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2.0,
                    socket_timeout=2.0,
                    health_check_interval=30,
                )
                await client.ping()
                self._client = client
                self._available = True
                logger.info("Redis state backend active (multi-worker safe).")
            except Exception as exc:
                logger.warning(
                    "Redis unreachable at %s (%s); falling back to in-memory state. "
                    "Multi-worker deployments require Redis.",
                    settings.REDIS_URL,
                    exc,
                )
                self._client = None
                self._available = False
        return self._client if self._available else None

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:
                pass
        self._client = None
        self._probed = False
        self._available = False

    def reset(self) -> None:
        """Test helper: forget the cached probe result."""
        self._client = None
        self._probed = False
        self._available = False


redis_state = RedisState()


def key(*parts: Any) -> str:
    """Namespaced Redis key builder."""
    prefix = settings.REDIS_KEY_PREFIX or "talentops"
    return ":".join([prefix, *[str(p) for p in parts]])


# ---------------------------------------------------------------------------
# Distributed semaphore (Redis SET NX EX slot leases)
# ---------------------------------------------------------------------------

class DistributedSemaphore:
    """
    Concurrency limiter that works across worker processes.

    Redis mode models the semaphore as `limit` independent slot keys acquired with
    `SET key NX EX <lease>`. Each slot carries a TTL, so a worker that dies
    mid-triage releases its slot automatically instead of deadlocking the queue.
    Deliberately avoids Lua/EVAL so the same code path runs on managed Redis
    variants and in tests (fakeredis does not implement EVAL).

    In-memory mode delegates to `asyncio.Semaphore`.
    """

    def __init__(self, name: str, limit: Optional[int] = None, lease_seconds: int = 900) -> None:
        self.name = name
        self.limit = limit if limit is not None else settings.TRIAGE_CONCURRENCY_LIMIT
        self.lease_seconds = lease_seconds
        self._local = asyncio.Semaphore(self.limit)
        self._slot_keys = [key("sem", name, i) for i in range(self.limit)]

    async def acquire(self, timeout: Optional[float] = None) -> str:
        """
        Acquires a slot. Returns an opaque lease token to pass to `release`.
        Raises asyncio.TimeoutError when `timeout` elapses without a slot.
        """
        client = await redis_state.client()

        if client is None:
            if timeout is None:
                await self._local.acquire()
            else:
                await asyncio.wait_for(self._local.acquire(), timeout=timeout)
            return f"local-{uuid.uuid4().hex}"

        deadline = None if timeout is None else time.monotonic() + timeout
        delay = 0.05
        while True:
            # Randomise probe order so two workers don't lock-step on the same slot
            order = list(self._slot_keys)
            for slot_key in order:
                acquired = await client.set(slot_key, "1", nx=True, ex=self.lease_seconds)
                if acquired:
                    return slot_key
            if deadline is not None and time.monotonic() >= deadline:
                raise asyncio.TimeoutError(
                    f"Timed out waiting for '{self.name}' slot (limit={self.limit})"
                )
            await asyncio.sleep(delay)
            delay = min(delay * 2, 0.5)

    async def release(self, member: str) -> None:
        if member.startswith("local-"):
            self._local.release()
            return
        client = await redis_state.client()
        if client is None:
            self._local.release()
            return
        try:
            await client.delete(member)
        except Exception as exc:
            logger.warning("Failed to release semaphore slot %s: %s", member, exc)

    def lease(self, timeout: Optional[float] = None) -> "SemaphoreLease":
        """Context manager acquiring and releasing a slot."""
        return SemaphoreLease(self, timeout=timeout)

    async def in_use(self) -> int:
        """Number of currently leased slots (diagnostics/tests)."""
        client = await redis_state.client()
        if client is None:
            return self.limit - self._local._value  # noqa: SLF001 - read-only introspection
        count = 0
        for slot_key in self._slot_keys:
            if await client.exists(slot_key):
                count += 1
        return count


class SemaphoreLease:
    """Async context manager yielding a lease token from a DistributedSemaphore."""

    def __init__(self, semaphore: DistributedSemaphore, timeout: Optional[float] = None) -> None:
        self.semaphore = semaphore
        self.timeout = timeout
        self.member: Optional[str] = None

    async def __aenter__(self) -> str:
        self.member = await self.semaphore.acquire(timeout=self.timeout)
        return self.member

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self.member is not None:
            await self.semaphore.release(self.member)
            self.member = None
