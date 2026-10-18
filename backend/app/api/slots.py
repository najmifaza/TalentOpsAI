import logging
from typing import Optional
from fastapi import APIRouter, Depends, Form, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.adapters.calendar import mock_calendar_adapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/slots", tags=["Calendar & Scheduling"])


class ReserveSlotRequest(BaseModel):
    slot_id: int = Field(..., description="ID slot wawancara")
    candidate_id: int = Field(..., description="ID kandidat pemohon reservasi")
    interviewer_id: int = Field(..., description="ID pewawancara pemilik slot")
    tentative_minutes: int = Field(default=60, ge=5, le=1440, description="Durasi TTL penguncian sementara (menit)")


@router.get("/available")
async def get_available_slots(
    interviewer_id: Optional[int] = Query(None, description="Filter berdasarkan ID pewawancara"),
    db: AsyncSession = Depends(get_db),
):
    """
    PRD Bab 8.2 (Item 12):
    Retrieves available interview slots for interview scheduling.
    First runs background cleaner to release expired tentative slots.
    """
    # Auto-release expired tentative slots
    await mock_calendar_adapter.release_expired_tentative_slots(db)
    await db.commit()

    query_str = """
        SELECT s.id, s.interviewer_id, u.username as interviewer_name,
               s.start_time, s.end_time, s.status
        FROM interview_slots s
        JOIN users u ON s.interviewer_id = u.id
        WHERE s.status = 'available'
    """
    params = {}
    if interviewer_id is not None:
        query_str += " AND s.interviewer_id = :interviewer_id"
        params["interviewer_id"] = interviewer_id

    query_str += " ORDER BY s.start_time ASC LIMIT 50"

    res = await db.execute(text(query_str), params)
    slots = []
    for row in res.mappings():
        slots.append({
            "id": row["id"],
            "interviewer_id": row["interviewer_id"],
            "interviewer_name": row["interviewer_name"],
            "start_time": row["start_time"].isoformat() if hasattr(row["start_time"], "isoformat") else str(row["start_time"]),
            "end_time": row["end_time"].isoformat() if hasattr(row["end_time"], "isoformat") else str(row["end_time"]),
            "status": row["status"],
            "tag": mock_calendar_adapter.TAG,
        })

    return {
        "status": "success",
        "total_available": len(slots),
        "data": slots,
        "tag": mock_calendar_adapter.TAG,
    }


@router.post("/reserve")
async def reserve_interview_slot(
    payload: ReserveSlotRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    PRD Bab 8.2 (Item 13) & Bab 6.3:
    Atomically locks an interview slot to 'tentative' using SELECT ... FOR UPDATE.
    Enforces strict lock hierarchy, anti-double-booking, and interval non-overlap validation.
    Generates deterministic client-generated event ID for Google Calendar API compatibility.
    """
    result = await mock_calendar_adapter.reserve_slot(
        db=db,
        slot_id=payload.slot_id,
        candidate_id=payload.candidate_id,
        interviewer_id=payload.interviewer_id,
        tentative_minutes=payload.tentative_minutes,
    )

    if not result.get("success"):
        reason = result.get("reason", "UNKNOWN_ERROR")
        status_code = 409 if "CONFLICT" in reason or "ALREADY" in reason else 400
        raise HTTPException(
            status_code=status_code,
            detail={
                "error": reason,
                "message": f"Gagal mengunci slot kalender: {reason}",
                "tag": mock_calendar_adapter.TAG,
            },
        )

    await db.commit()
    return result
