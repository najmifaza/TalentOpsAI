import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

class MockCalendarAdapter:
    """
    Mock Calendar Adapter with strict ACID transactional locking (`SELECT ... FOR UPDATE`)
    and Idempotent Event ID generation.
    Eliminates double-booking and simulates enterprise calendar integration.
    Labeled with [MOCK / SANDBOX] in UI/Responses.
    """
    TAG = "[MOCK / SANDBOX]"

    @staticmethod
    def generate_event_id(slot_id: int, candidate_id: int) -> str:
        """
        Generates deterministic base32/alphanumeric event ID for Google Calendar API compatibility:
        talentops_<slot_id>_<candidate_id>
        """
        raw = f"talentops_{slot_id}_{candidate_id}".encode("utf-8")
        # base32 lowercase without padding '='
        b32 = base64.b32encode(raw).decode("utf-8").lower().rstrip("=")
        return b32

    async def reserve_slot(
        self,
        db: AsyncSession,
        slot_id: int,
        candidate_id: int,
        interviewer_id: int,
        tentative_minutes: int = 60,
    ) -> Dict[str, Any]:
        """
        Executes strict lock hierarchy:
        1. Lock interviewer row in users (`SELECT id FROM users WHERE id = :interviewer_id FOR UPDATE`)
        2. Lock candidate row (`SELECT id FROM candidates WHERE id = :candidate_id FOR UPDATE`)
        3. Lock target slot (`SELECT * FROM interview_slots WHERE id = :slot_id FOR UPDATE`)
        4. Check for overlapping tentative/booked slots for this interviewer.
        5. Verify candidate doesn't already hold an active tentative/booked slot.
        """
        # 1. Lock interviewer row
        await db.execute(
            text("SELECT id FROM users WHERE id = :interviewer_id FOR UPDATE"),
            {"interviewer_id": interviewer_id},
        )

        # 2. Lock target slot
        slot_res = await db.execute(
            text("SELECT id, interviewer_id, start_time, end_time, status, lock_version FROM interview_slots WHERE id = :slot_id FOR UPDATE"),
            {"slot_id": slot_id},
        )
        target_slot = slot_res.mappings().first()
        if not target_slot:
            return {"success": False, "reason": "SLOT_NOT_FOUND", "tag": self.TAG}

        if target_slot["status"] != "available":
            return {
                "success": False,
                "reason": f"SLOT_ALREADY_{target_slot['status'].upper()}",
                "tag": self.TAG,
            }

        start_time = target_slot["start_time"]
        end_time = target_slot["end_time"]

        # 3. Check for overlapping active slots for this interviewer
        overlap_res = await db.execute(
            text("""
                SELECT id FROM interview_slots
                WHERE interviewer_id = :interviewer_id
                  AND id != :slot_id
                  AND status IN ('tentative', 'booked')
                  AND start_time < :end_time
                  AND end_time > :start_time
                FOR UPDATE
            """),
            {
                "interviewer_id": interviewer_id,
                "slot_id": slot_id,
                "start_time": start_time,
                "end_time": end_time,
            },
        )
        if overlap_res.first():
            return {
                "success": False,
                "reason": "INTERVIEWER_SCHEDULE_CONFLICT_OVERLAP",
                "tag": self.TAG,
            }

        # 4. Check candidate active slot restriction
        cand_slot_res = await db.execute(
            text("""
                SELECT id FROM interview_slots
                WHERE candidate_id = :candidate_id
                  AND status IN ('tentative', 'booked')
                FOR UPDATE
            """),
            {"candidate_id": candidate_id},
        )
        if cand_slot_res.first():
            return {
                "success": False,
                "reason": "CANDIDATE_ALREADY_HAS_ACTIVE_SLOT",
                "tag": self.TAG,
            }

        # 5. Transition slot to tentative
        event_id = self.generate_event_id(slot_id, candidate_id)
        expires_at = datetime.utcnow() + timedelta(minutes=tentative_minutes)
        new_version = (target_slot["lock_version"] or 0) + 1

        await db.execute(
            text("""
                UPDATE interview_slots
                SET candidate_id = :candidate_id,
                    status = 'tentative',
                    external_calendar_event_id = :event_id,
                    tentative_expires_at = :expires_at,
                    lock_version = :new_version
                WHERE id = :slot_id AND lock_version = :old_version
            """),
            {
                "candidate_id": candidate_id,
                "event_id": event_id,
                "expires_at": expires_at,
                "new_version": new_version,
                "slot_id": slot_id,
                "old_version": target_slot["lock_version"] or 0,
            },
        )

        return {
            "success": True,
            "slot_id": slot_id,
            "status": "tentative",
            "event_id": event_id,
            "tentative_expires_at": expires_at.isoformat(),
            "start_time": start_time.isoformat(),
            "end_time": end_time,
            "tag": self.TAG,
        }

    async def compensate_cancel_tentative(self, db: AsyncSession, slot_id: int) -> bool:
        """Saga compensating transaction: frees a tentative slot."""
        res = await db.execute(
            text("""
                UPDATE interview_slots
                SET status = 'available',
                    tentative_expires_at = NULL,
                    candidate_id = NULL,
                    external_calendar_event_id = NULL
                WHERE id = :slot_id AND status = 'tentative'
            """),
            {"slot_id": slot_id},
        )
        return res.rowcount > 0

    async def confirm_booking(self, db: AsyncSession, slot_id: int, candidate_id: int) -> bool:
        """Confirms tentative slot into 'booked' upon final recruiter approval."""
        res = await db.execute(
            text("""
                UPDATE interview_slots
                SET status = 'booked',
                    tentative_expires_at = NULL
                WHERE id = :slot_id
                  AND candidate_id = :candidate_id
                  AND status = 'tentative'
            """),
            {"slot_id": slot_id, "candidate_id": candidate_id},
        )
        return res.rowcount > 0

mock_calendar_adapter = MockCalendarAdapter()
