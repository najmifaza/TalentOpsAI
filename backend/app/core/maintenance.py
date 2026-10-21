"""Periodic background maintenance.

PRD Bab 6.3 (cleaner slot `tentative`) and PRD Bab 8.2 / baris 388 (ephemeral demo
storage). Both jobs used to run only when a request happened to hit the endpoint
that triggered them, so a slot could stay `tentative` for hours and demo uploads
never expired. The loops below make them time-driven instead.
"""

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import text

from app.adapters.calendar import mock_calendar_adapter
from app.core.config import settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

SLOT_CLEANER_INTERVAL_SECONDS = 300  # PRD Bab 6.3: every 5 minutes
DEMO_PURGE_INTERVAL_SECONDS = 4 * 3600  # PRD Bab 8.2: every 4 hours
DEMO_RETENTION_HOURS = 4


async def release_expired_slots() -> None:
    async with AsyncSessionLocal() as db:
        freed = await mock_calendar_adapter.release_expired_tentative_slots(db)
        await db.commit()
    if freed:
        logger.info("maintenance: released %s expired tentative slot(s)", freed)


async def purge_demo_candidates() -> None:
    """Hard-deletes candidates older than the demo retention window.

    ponytail: no marker distinguishes a demo upload from the seeded golden dataset,
    so this removes every candidate past the cutoff — including the dataset used for
    judging. That is why it is opt-in via DEMO_PURGE_ENABLED instead of following
    DEMO_MODE. Upgrade path: add an `is_demo` column and filter on it.
    """
    cutoff = datetime.utcnow() - timedelta(hours=DEMO_RETENTION_HOURS)
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            text("DELETE FROM candidates WHERE created_at < :cutoff"),
            {"cutoff": cutoff},
        )
        await db.commit()
    if res.rowcount:
        logger.info("maintenance: purged %s demo candidate row(s)", res.rowcount)


async def _run_forever(name: str, interval: int, job) -> None:
    while True:
        try:
            await job()
        except asyncio.CancelledError:
            raise
        except Exception:
            # One bad tick (DB down, lock timeout) must not kill the loop.
            logger.exception("maintenance: %s tick failed", name)
        await asyncio.sleep(interval)


def start_background_tasks() -> list[asyncio.Task]:
    if not settings.MAINTENANCE_ENABLED:
        return []
    jobs = [("slot-cleaner", SLOT_CLEANER_INTERVAL_SECONDS, release_expired_slots)]
    if settings.DEMO_PURGE_ENABLED:
        jobs.append(("demo-purge", DEMO_PURGE_INTERVAL_SECONDS, purge_demo_candidates))
    tasks = [asyncio.create_task(_run_forever(n, i, j), name=f"maintenance:{n}") for n, i, j in jobs]
    logger.info("maintenance: started %s", ", ".join(t.get_name() for t in tasks))
    return tasks


async def stop_background_tasks(tasks: list[asyncio.Task]) -> None:
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
