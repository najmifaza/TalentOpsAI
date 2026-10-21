"""Guards for the periodic maintenance loops (app/core/maintenance.py)."""

import asyncio
import logging

import pytest

from app.core import maintenance
from app.core.config import settings


def test_start_background_tasks_respects_flag():
    original = settings.MAINTENANCE_ENABLED
    settings.MAINTENANCE_ENABLED = False
    try:
        assert maintenance.start_background_tasks() == []
    finally:
        settings.MAINTENANCE_ENABLED = original


@pytest.mark.asyncio
async def test_demo_purge_only_starts_when_explicitly_enabled():
    original_maint = settings.MAINTENANCE_ENABLED
    original_purge = settings.DEMO_PURGE_ENABLED
    settings.MAINTENANCE_ENABLED = True
    settings.DEMO_PURGE_ENABLED = False
    try:
        tasks = maintenance.start_background_tasks()
        try:
            names = {t.get_name() for t in tasks}
        finally:
            for t in tasks:
                t.cancel()
        assert names == {"maintenance:slot-cleaner"}
    finally:
        settings.MAINTENANCE_ENABLED = original_maint
        settings.DEMO_PURGE_ENABLED = original_purge


@pytest.mark.asyncio
async def test_run_forever_survives_a_failing_tick():
    calls = []

    async def boom():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("db down")
        raise asyncio.CancelledError

    task = asyncio.create_task(maintenance._run_forever("probe", 0, boom))
    for _ in range(200):
        await asyncio.sleep(0.005)
        if len(calls) >= 2:
            break
    # The second tick proves the loop kept going after the first one raised.
    assert len(calls) >= 2
    await maintenance.stop_background_tasks([task])
    assert task.cancelled() or task.done()


def test_app_logging_reaches_stderr():
    """
    Uvicorn only attaches handlers to `uvicorn.*` loggers, so without a root handler
    every module's INFO log is dropped before it reaches journald — that is how
    `maintenance: started` went missing in production. Guard the root config.
    """
    import app.main  # noqa: F401  (module-level basicConfig is the thing under test)

    root = logging.getLogger()
    assert root.handlers, "root logger has no handler; app INFO logs will be discarded"
    assert logging.getLogger("app.core.maintenance").isEnabledFor(logging.INFO)
