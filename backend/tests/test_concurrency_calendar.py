"""
Sprint 4 - Automated Concurrency Test for MockCalendarAdapter
Verifies 50 simultaneous reservation transactions with strict ACID lock hierarchy
and interval non-overlap check. Proves ZERO double-booking.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import pytest
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.adapters.calendar import MockCalendarAdapter


class MockRow:
    rowcount: int = 0

    def __init__(self, data: Dict[str, Any], rowcount: int = 0):
        self._data = dict(data)
        self.rowcount = rowcount

    def __getitem__(self, key: str):
        return self._data[key]

    def get(self, key: str, default=None):
        return self._data.get(key, default)

    def mappings(self):
        return self

    def first(self):
        return self._data

    def fetchall(self):
        return [self._data]


class ConcurrentDBStore:
    """
    In-memory ACID concurrency simulation store.
    Simulates row-level locking (SELECT ... FOR UPDATE) and transactional commit/rollback.
    """

    def __init__(self):
        self.users: Dict[int, Dict[str, Any]] = {}
        self.interview_slots: Dict[int, Dict[str, Any]] = {}
        self.candidates: Dict[int, Dict[str, Any]] = {}
        # Mutex per table/row simulating MariaDB InnoDB row locks
        self._row_locks: Dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()

    async def get_row_lock(self, table: str, row_id: int) -> asyncio.Lock:
        key = f"{table}:{row_id}"
        async with self._global_lock:
            if key not in self._row_locks:
                self._row_locks[key] = asyncio.Lock()
            return self._row_locks[key]


class ConcurrentDBSession:
    """
    Represents an isolated AsyncSession with lock acquisition and commit behavior.
    """

    def __init__(self, store: ConcurrentDBStore):
        self.store = store
        self.acquired_locks: List[asyncio.Lock] = []
        self.pending_updates: List[tuple] = []

    async def execute(self, statement: Any, params: Optional[Dict[str, Any]] = None):
        sql = str(statement).strip().upper()
        params = params or {}

        # 1. Lock interviewer row: SELECT ID FROM USERS WHERE ID = :interviewer_id FOR UPDATE
        if "FROM USERS" in sql and "FOR UPDATE" in sql:
            uid = params.get("interviewer_id") or params.get("id")
            if uid is not None:
                lock = await self.store.get_row_lock("users", uid)
                await lock.acquire()
                self.acquired_locks.append(lock)
                user = self.store.users.get(uid)
                if user:
                    return MockRow({"id": uid})
            return MockRow({})

        # 2. Lock target slot: SELECT ID, ... FROM INTERVIEW_SLOTS WHERE ID = :slot_id FOR UPDATE
        if "FROM INTERVIEW_SLOTS" in sql and "WHERE ID = :SLOT_ID" in sql and "FOR UPDATE" in sql:
            slot_id = params.get("slot_id")
            if slot_id is not None:
                lock = await self.store.get_row_lock("interview_slots", slot_id)
                await lock.acquire()
                self.acquired_locks.append(lock)
                slot = self.store.interview_slots.get(slot_id)
                if slot:
                    return MockRow(slot)
            return MockRow({})

        # 3. Check for overlapping active slots for interviewer
        if "FROM INTERVIEW_SLOTS" in sql and "INTERVIEWER_ID = :INTERVIEWER_ID" in sql and "STATUS IN ('TENTATIVE', 'BOOKED')" in sql:
            interviewer_id = params.get("interviewer_id")
            slot_id = params.get("slot_id")
            start_time = params.get("start_time")
            end_time = params.get("end_time")

            conflicts = []
            for sid, s in self.store.interview_slots.items():
                if (
                    s.get("interviewer_id") == interviewer_id
                    and sid != slot_id
                    and s.get("status") in ("tentative", "booked")
                ):
                    s_start = s["start_time"]
                    s_end = s["end_time"]
                    # start_time < :end_time AND end_time > :start_time
                    if s_start < end_time and s_end > start_time:
                        conflicts.append(s)

            if conflicts:
                return MockRow({"id": conflicts[0]["id"]})
            return MockRow({})

        # 4. Check candidate active slot restriction
        if "FROM INTERVIEW_SLOTS" in sql and "CANDIDATE_ID = :CANDIDATE_ID" in sql:
            cand_id = params.get("candidate_id")
            for sid, s in self.store.interview_slots.items():
                if s.get("candidate_id") == cand_id and s.get("status") in ("tentative", "booked"):
                    return MockRow({"id": sid})
            return MockRow({})

        # 5. UPDATE interview_slots
        if "UPDATE INTERVIEW_SLOTS" in sql:
            slot_id = params.get("slot_id")
            old_version = params.get("old_version", 0)
            slot = self.store.interview_slots.get(int(slot_id)) if slot_id is not None else None
            if slot and (slot.get("lock_version") or 0) == old_version:
                # Apply changes directly to slot copy in store
                slot["candidate_id"] = params.get("candidate_id")
                slot["status"] = params.get("status", "tentative")
                slot["external_calendar_event_id"] = params.get("event_id")
                slot["tentative_expires_at"] = params.get("expires_at")
                slot["lock_version"] = params.get("new_version")
                return MockRow({"rowcount": 1}, rowcount=1)
            return MockRow({"rowcount": 0}, rowcount=0)

        return MockRow({})

    async def commit(self):
        # Release all locks held by this transaction upon commit
        for lock in self.acquired_locks:
            if lock.locked():
                lock.release()
        self.acquired_locks.clear()

    async def rollback(self):
        # Release all locks on rollback
        for lock in self.acquired_locks:
            if lock.locked():
                lock.release()
        self.acquired_locks.clear()


@pytest.mark.asyncio
async def test_50_concurrent_transactions_single_slot_zero_double_booking():
    """
    Stress test: 50 simultaneous candidates attempt to reserve the EXACT SAME slot.
    Requirement:
    - Exactly 1 candidate succeeds.
    - Exactly 49 candidates are rejected (SLOT_ALREADY_TENTATIVE / version check).
    - Double booking count is strictly 0.
    - Slot status transitions to 'tentative' with lock_version incremented to 1.
    """
    store = ConcurrentDBStore()
    adapter = MockCalendarAdapter()

    # Seed interviewer
    store.users[1] = {"id": 1, "role": "interviewer", "name": "Lead Architect"}

    # Seed target single available slot
    now = datetime.utcnow()
    target_slot_id = 101
    store.interview_slots[target_slot_id] = {
        "id": target_slot_id,
        "interviewer_id": 1,
        "start_time": now + timedelta(days=1, hours=10),
        "end_time": now + timedelta(days=1, hours=11),
        "status": "available",
        "candidate_id": None,
        "lock_version": 0,
        "external_calendar_event_id": None,
        "tentative_expires_at": None,
    }

    async def attempt_reservation(candidate_id: int) -> Dict[str, Any]:
        session = ConcurrentDBSession(store)
        try:
            res = await adapter.reserve_slot(
                db=session,
                slot_id=target_slot_id,
                candidate_id=candidate_id,
                interviewer_id=1,
                tentative_minutes=60,
            )
            await session.commit()
            return {"candidate_id": candidate_id, "result": res}
        except Exception as e:
            await session.rollback()
            return {"candidate_id": candidate_id, "error": str(e)}

    # Dispatch 50 concurrent transactions
    tasks = [attempt_reservation(candidate_id=i) for i in range(1, 51)]
    outcomes = await asyncio.gather(*tasks)

    successful = [o for o in outcomes if o.get("result", {}).get("success") is True]
    failed = [o for o in outcomes if o.get("result", {}).get("success") is False]

    # Verify assertions
    assert len(successful) == 1, f"Expected exactly 1 successful booking, got {len(successful)}"
    assert len(failed) == 49, f"Expected 49 failed reservations, got {len(failed)}"

    winner = successful[0]
    winner_cid = winner["candidate_id"]
    final_slot = store.interview_slots[target_slot_id]

    assert final_slot["status"] == "tentative"
    assert final_slot["candidate_id"] == winner_cid
    assert final_slot["lock_version"] == 1
    assert final_slot["external_calendar_event_id"] is not None

    # Prove zero double booking across all 49 rejected candidates
    for f in failed:
        assert "SLOT_ALREADY" in f["result"]["reason"]

    print(f"\n[PASS] Single Slot Concurrency: 50 Tx -> 1 Success (Cand #{winner_cid}), 49 Rejections, 0 Double Bookings.")


@pytest.mark.asyncio
async def test_50_concurrent_transactions_multi_slot_pool():
    """
    Stress test: 50 simultaneous candidates competing for 5 available slots (10 per slot).
    Requirement:
    - Exactly 5 candidates succeed (1 per slot).
    - Exactly 45 candidates fail.
    - Zero double bookings.
    """
    store = ConcurrentDBStore()
    adapter = MockCalendarAdapter()

    store.users[1] = {"id": 1, "role": "interviewer", "name": "Senior Reviewer"}

    now = datetime.utcnow()
    # 5 slots separated by 2 hours each to prevent overlap
    for sid in range(1, 6):
        store.interview_slots[sid] = {
            "id": sid,
            "interviewer_id": 1,
            "start_time": now + timedelta(days=2, hours=sid * 2),
            "end_time": now + timedelta(days=2, hours=sid * 2 + 1),
            "status": "available",
            "candidate_id": None,
            "lock_version": 0,
            "external_calendar_event_id": None,
            "tentative_expires_at": None,
        }

    async def attempt_booking(cand_id: int, target_slot_id: int) -> Dict[str, Any]:
        session = ConcurrentDBSession(store)
        try:
            res = await adapter.reserve_slot(
                db=session,
                slot_id=target_slot_id,
                candidate_id=cand_id,
                interviewer_id=1,
                tentative_minutes=60,
            )
            await session.commit()
            return {"cand_id": cand_id, "slot_id": target_slot_id, "result": res}
        except Exception as e:
            await session.rollback()
            return {"cand_id": cand_id, "slot_id": target_slot_id, "error": str(e)}

    # 50 transactions distributed evenly across 5 slots (10 per slot)
    tasks = []
    for cand_id in range(1, 51):
        target_slot = ((cand_id - 1) % 5) + 1
        tasks.append(attempt_booking(cand_id, target_slot))

    outcomes = await asyncio.gather(*tasks)

    successful = [o for o in outcomes if o.get("result", {}).get("success") is True]
    failed = [o for o in outcomes if o.get("result", {}).get("success") is False]

    assert len(successful) == 5, f"Expected 5 successful bookings, got {len(successful)}"
    assert len(failed) == 45, f"Expected 45 failed reservations, got {len(failed)}"

    booked_slot_ids = {s["slot_id"] for s in successful}
    assert booked_slot_ids == {1, 2, 3, 4, 5}, "Each of the 5 slots must be booked exactly once"

    # All slots in store are now tentative with lock_version = 1
    for sid in range(1, 6):
        assert store.interview_slots[sid]["status"] == "tentative"
        assert store.interview_slots[sid]["lock_version"] == 1

    print(f"\n[PASS] Multi-Slot Pool Concurrency: 50 Tx -> 5 Success (Slots 1-5), 45 Rejections, 0 Double Bookings.")


@pytest.mark.asyncio
async def test_50_concurrent_transactions_overlapping_schedule_rejection():
    """
    Stress test: 50 concurrent transactions attempt to book 2 overlapping slots for the same interviewer.
    Slot A: 10:00 - 11:00
    Slot B: 10:30 - 11:30 (overlaps by 30 mins)
    Requirement:
    - Only ONE slot can be reserved (Slot A OR Slot B).
    - The other slot MUST reject any reservation due to INTERVIEWER_SCHEDULE_CONFLICT_OVERLAP.
    - Zero overlapping schedule bookings.
    """
    store = ConcurrentDBStore()
    adapter = MockCalendarAdapter()

    store.users[1] = {"id": 1, "role": "interviewer", "name": "Staff Engineer"}

    now = datetime.utcnow()
    # Slot 201: 10:00 - 11:00
    store.interview_slots[201] = {
        "id": 201,
        "interviewer_id": 1,
        "start_time": now + timedelta(days=3, hours=10),
        "end_time": now + timedelta(days=3, hours=11),
        "status": "available",
        "candidate_id": None,
        "lock_version": 0,
        "external_calendar_event_id": None,
        "tentative_expires_at": None,
    }
    # Slot 202: 10:30 - 11:30 (conflicts with 201)
    store.interview_slots[202] = {
        "id": 202,
        "interviewer_id": 1,
        "start_time": now + timedelta(days=3, hours=10, minutes=30),
        "end_time": now + timedelta(days=3, hours=11, minutes=30),
        "status": "available",
        "candidate_id": None,
        "lock_version": 0,
        "external_calendar_event_id": None,
        "tentative_expires_at": None,
    }

    async def attempt_booking(cand_id: int, target_slot_id: int):
        session = ConcurrentDBSession(store)
        try:
            res = await adapter.reserve_slot(
                db=session,
                slot_id=target_slot_id,
                candidate_id=cand_id,
                interviewer_id=1,
            )
            await session.commit()
            return {"cand_id": cand_id, "slot_id": target_slot_id, "result": res}
        except Exception as e:
            await session.rollback()
            return {"cand_id": cand_id, "slot_id": target_slot_id, "error": str(e)}

    # 25 transactions for 201, 25 transactions for 202
    tasks = []
    for cand_id in range(1, 51):
        target = 201 if cand_id % 2 == 1 else 202
        tasks.append(attempt_booking(cand_id, target))

    outcomes = await asyncio.gather(*tasks)

    successful = [o for o in outcomes if o.get("result", {}).get("success") is True]
    failed = [o for o in outcomes if o.get("result", {}).get("success") is False]

    # Only one of the overlapping slots can be reserved!
    assert len(successful) == 1, f"Expected exactly 1 booking across overlapping slots, got {len(successful)}"
    assert len(failed) == 49, f"Expected 49 rejections, got {len(failed)}"

    # Check reasons of rejections
    overlap_conflicts = [f for f in failed if f["result"]["reason"] == "INTERVIEWER_SCHEDULE_CONFLICT_OVERLAP"]
    slot_already = [f for f in failed if "SLOT_ALREADY" in f["result"]["reason"]]

    # Both reasons are valid and prevent conflict
    assert len(overlap_conflicts) + len(slot_already) == 49

    # Double booking strictly 0
    assert not (store.interview_slots[201]["status"] == "tentative" and store.interview_slots[202]["status"] == "tentative")

    print(f"\n[PASS] Overlapping Conflict Concurrency: 50 Tx -> 1 Success, 49 Rejections (0 Schedule Overlap).")


@pytest.mark.asyncio
async def test_candidate_duplicate_booking_prevention_50_concurrent_tx():
    """
    Stress test: Same candidate attempts to book 50 different available slots concurrently.
    Requirement:
    - Candidate can hold at most 1 active tentative slot.
    - Exactly 1 transaction succeeds, 49 fail with CANDIDATE_ALREADY_HAS_ACTIVE_SLOT.
    """
    store = ConcurrentDBStore()
    adapter = MockCalendarAdapter()

    now = datetime.utcnow()
    # 50 interviewers and 50 available non-overlapping slots
    for i in range(1, 51):
        store.users[i] = {"id": i, "role": "interviewer"}
        store.interview_slots[i] = {
            "id": i,
            "interviewer_id": i,
            "start_time": now + timedelta(days=i),
            "end_time": now + timedelta(days=i, hours=1),
            "status": "available",
            "candidate_id": None,
            "lock_version": 0,
            "external_calendar_event_id": None,
            "tentative_expires_at": None,
        }

    candidate_id = 999  # Same candidate

    async def attempt_booking(slot_id: int):
        session = ConcurrentDBSession(store)
        try:
            res = await adapter.reserve_slot(
                db=session,
                slot_id=slot_id,
                candidate_id=candidate_id,
                interviewer_id=slot_id,
            )
            await session.commit()
            return {"slot_id": slot_id, "result": res}
        except Exception as e:
            await session.rollback()
            return {"slot_id": slot_id, "error": str(e)}

    tasks = [attempt_booking(slot_id=s) for s in range(1, 51)]
    outcomes = await asyncio.gather(*tasks)

    successful = [o for o in outcomes if o.get("result", {}).get("success") is True]
    failed = [o for o in outcomes if o.get("result", {}).get("success") is False]

    assert len(successful) == 1, f"Expected candidate to get at most 1 slot, got {len(successful)}"
    assert len(failed) == 49

    for f in failed:
        assert f["result"]["reason"] == "CANDIDATE_ALREADY_HAS_ACTIVE_SLOT"

    print(f"\n[PASS] Candidate Single Slot Policy: 50 Tx -> 1 Success, 49 Rejections (CANDIDATE_ALREADY_HAS_ACTIVE_SLOT).")
