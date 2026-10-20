"""
Multi-worker state backend test suite (Redis path + in-memory fallback).

Uses fakeredis to exercise the real Redis code paths without a server:
  - SSE single-use ticket issue/burn via GETDEL (atomic across workers)
  - SSE history replay + pub/sub fan-out across two broadcaster instances
    (simulating two Uvicorn workers sharing one Redis)
  - DistributedSemaphore cross-process limit enforcement and lease TTL release
  - Graceful fallback to in-memory when Redis is unreachable
"""
import asyncio
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

import fakeredis.aioredis as fakeredis
import pytest_asyncio

from app.core.broadcaster import SSEBroadcaster
from app.core.config import settings
from app.core.state import DistributedSemaphore, redis_state


@pytest_asyncio.fixture
async def fake_redis():
    """Attaches a fakeredis client to the shared redis_state singleton."""
    original_url = settings.REDIS_URL
    client = fakeredis.FakeRedis(decode_responses=True)
    settings.REDIS_URL = "redis://fake:6379/0"
    redis_state._client = client
    redis_state._probed = True
    redis_state._available = True
    try:
        yield client
    finally:
        await client.aclose()
        settings.REDIS_URL = original_url
        redis_state.reset()


@pytest_asyncio.fixture
async def no_redis():
    """Forces the in-memory fallback path."""
    original_url = settings.REDIS_URL
    settings.REDIS_URL = ""
    redis_state.reset()
    try:
        yield
    finally:
        settings.REDIS_URL = original_url
        redis_state.reset()


@pytest.mark.asyncio
async def test_redis_ticket_single_use_across_workers(fake_redis):
    """
    A ticket issued by 'worker A' must be redeemable exactly once, and a second
    redemption — even from a different broadcaster instance sharing the same Redis —
    must fail. This is the bug the in-memory store had under --workers > 1.
    """
    worker_a = SSEBroadcaster()
    worker_b = SSEBroadcaster()

    ticket = await worker_a.issue_ticket(candidate_id=7)
    assert isinstance(ticket, str) and len(ticket) > 10

    # Wrong candidate must not burn it
    assert await worker_b.validate_and_burn_ticket(candidate_id=99, ticket=ticket) is False

    # Redeem on the *other* worker, then confirm it is burned everywhere
    assert await worker_b.validate_and_burn_ticket(candidate_id=7, ticket=ticket) is True
    assert await worker_a.validate_and_burn_ticket(candidate_id=7, ticket=ticket) is False
    assert await worker_b.validate_and_burn_ticket(candidate_id=7, ticket=ticket) is False


@pytest.mark.asyncio
async def test_redis_ticket_expires(fake_redis):
    """Tickets must expire after their TTL instead of lingering in memory."""
    broadcaster = SSEBroadcaster()
    ticket = await broadcaster.issue_ticket(candidate_id=3)
    await fake_redis.delete(f"talentops:sse:ticket:{ticket}")
    assert await broadcaster.validate_and_burn_ticket(candidate_id=3, ticket=ticket) is False


@pytest.mark.asyncio
async def test_redis_publish_history_and_cross_worker_fanout(fake_redis):
    """
    Events published on worker A must reach a subscriber on worker B, and a late
    subscriber must still receive the buffered history.
    """
    worker_a = SSEBroadcaster()
    worker_b = SSEBroadcaster()
    candidate_id = 21

    await worker_a.publish(candidate_id, "ingestion", "started", {"run_id": "r1"})
    await worker_a.publish(candidate_id, "extraction", "started", {"run_id": "r1"})
    await worker_a.publish(candidate_id, "scoring", "completed", {"score": 88.0})

    received = []
    async def collect():
        async for event in worker_b.subscribe(candidate_id):
            received.append(event)

    await asyncio.wait_for(collect(), timeout=5.0)

    assert len(received) == 3
    assert received[0]["step"] == "ingestion"
    assert received[1]["step"] == "extraction"
    assert received[2]["status"] == "completed"
    # Generator must stop on the terminal event, not hang
    assert received[-1]["event"] == "completed"


@pytest.mark.asyncio
async def test_redis_live_event_reaches_active_subscriber(fake_redis):
    """A subscriber attached before publish must receive the live event via pub/sub."""
    subscriber_worker = SSEBroadcaster()
    publisher_worker = SSEBroadcaster()
    candidate_id = 33

    received = []

    async def consume():
        async for event in subscriber_worker.subscribe(candidate_id):
            received.append(event)

    task = asyncio.create_task(consume())
    await asyncio.sleep(0.1)  # let SUBSCRIBE register
    await publisher_worker.publish(candidate_id, "verification", "started")
    await publisher_worker.publish(candidate_id, "synthesis", "completed")

    await asyncio.wait_for(task, timeout=5.0)
    steps = [e["step"] for e in received]
    assert "verification" in steps
    assert steps[-1] == "synthesis"


@pytest.mark.asyncio
async def test_redis_history_is_trimmed(fake_redis):
    """Replay buffer must be capped so a long run cannot grow unbounded."""
    original = settings.SSE_HISTORY_MAX_EVENTS
    settings.SSE_HISTORY_MAX_EVENTS = 5
    try:
        broadcaster = SSEBroadcaster()
        for i in range(12):
            await broadcaster.publish(1, f"step_{i}", "started")
        stored = await fake_redis.llen("talentops:sse:history:1")
        assert stored == 5
        # Newest events survive the trim
        tail = await fake_redis.lrange("talentops:sse:history:1", -1, -1)
        assert "step_11" in tail[0]
    finally:
        settings.SSE_HISTORY_MAX_EVENTS = original


@pytest.mark.asyncio
async def test_redis_semaphore_enforces_limit_across_workers(fake_redis):
    """
    Two semaphore instances sharing Redis (i.e. two workers) must together never
    exceed the configured limit — the per-process asyncio.Semaphore did not.
    """
    sem_a = DistributedSemaphore("triage", limit=2, lease_seconds=60)
    sem_b = DistributedSemaphore("triage", limit=2, lease_seconds=60)

    lease_1 = await sem_a.acquire()
    lease_2 = await sem_b.acquire()
    assert await sem_a.in_use() == 2

    # Third acquisition on either worker must time out
    with pytest.raises(asyncio.TimeoutError):
        await sem_a.acquire(timeout=0.3)
    with pytest.raises(asyncio.TimeoutError):
        await sem_b.acquire(timeout=0.3)

    # Releasing one slot frees capacity for the other worker
    await sem_a.release(lease_1)
    lease_3 = await sem_b.acquire(timeout=1.0)
    assert lease_3 is not None
    assert await sem_a.in_use() == 2

    await sem_b.release(lease_2)
    await sem_b.release(lease_3)
    assert await sem_a.in_use() == 0


@pytest.mark.asyncio
async def test_redis_semaphore_lease_ttl_self_heals(fake_redis):
    """A worker that dies mid-triage must not hold its slot forever."""
    sem = DistributedSemaphore("triage", limit=1, lease_seconds=60)
    lease = await sem.acquire()
    assert await sem.in_use() == 1

    # Simulate process death: slot key expires without release()
    await fake_redis.delete(lease)
    new_lease = await sem.acquire(timeout=1.0)
    assert new_lease is not None
    await sem.release(new_lease)


@pytest.mark.asyncio
async def test_semaphore_lease_context_manager(fake_redis):
    """The lease() context manager must always release, even on exception."""
    sem = DistributedSemaphore("triage", limit=1, lease_seconds=60)

    async with sem.lease() as lease:
        assert await sem.in_use() == 1
        assert lease

    assert await sem.in_use() == 0

    with pytest.raises(ValueError):
        async with sem.lease():
            raise ValueError("boom")

    assert await sem.in_use() == 0


@pytest.mark.asyncio
async def test_in_memory_fallback_when_redis_absent(no_redis):
    """Without Redis the original single-worker behaviour must be preserved."""
    broadcaster = SSEBroadcaster()
    ticket = await broadcaster.issue_ticket(candidate_id=5)
    assert await broadcaster.validate_and_burn_ticket(candidate_id=5, ticket=ticket) is True
    assert await broadcaster.validate_and_burn_ticket(candidate_id=5, ticket=ticket) is False
    assert await broadcaster.backend_name() == "in-memory"

    sem = DistributedSemaphore("triage", limit=1, lease_seconds=60)
    async with sem.lease():
        assert await sem.in_use() == 1
    assert await sem.in_use() == 0


@pytest.mark.asyncio
async def test_unreachable_redis_falls_back_gracefully():
    """A bad REDIS_URL must degrade to in-memory instead of crashing the app."""
    original_url = settings.REDIS_URL
    redis_state.reset()
    settings.REDIS_URL = "redis://127.0.0.1:6390/0"  # nothing listening
    try:
        client = await redis_state.client()
        assert client is None
        assert await SSEBroadcaster().backend_name() == "in-memory"
    finally:
        settings.REDIS_URL = original_url
        redis_state.reset()
