import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import require_roles
from app.adapters.calendar import mock_calendar_adapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/slots", tags=["Calendar & Scheduling"])


class ReserveSlotRequest(BaseModel):
    slot_id: int = Field(..., description="ID slot wawancara")
    candidate_id: int = Field(..., description="ID kandidat pemohon reservasi")
    interviewer_id: int = Field(..., description="ID pewawancara pemilik slot")
    tentative_minutes: int = Field(default=60, ge=5, le=1440, description="Durasi TTL penguncian sementara (menit)")


@router.get("")
async def list_interview_slots(
    status: Optional[str] = Query(None, description="Filter status: available, tentative, booked"),
    interviewer_id: Optional[int] = Query(None, description="Filter berdasarkan ID pewawancara"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
):
    """
    Mengambil seluruh daftar slot wawancara dengan relasi pewawancara dan kandidat,
    dilengkapi URL ekspor 1-klik ke Google Calendar pribadi (zero backend credential).
    """
    await mock_calendar_adapter.release_expired_tentative_slots(db)
    await db.commit()

    query_str = """
        SELECT s.id, s.interviewer_id, u.username as interviewer_name,
               s.candidate_id, c.masked_identifier, j.title as job_title,
               s.start_time, s.end_time, s.status, s.external_calendar_event_id
        FROM interview_slots s
        JOIN users u ON s.interviewer_id = u.id
        LEFT JOIN candidates c ON s.candidate_id = c.id
        LEFT JOIN job_descriptions j ON c.job_id = j.id
        WHERE 1=1
    """
    params = {}
    if status:
        query_str += " AND s.status = :status"
        params["status"] = status
    if interviewer_id is not None:
        query_str += " AND s.interviewer_id = :interviewer_id"
        params["interviewer_id"] = interviewer_id

    query_str += " ORDER BY s.start_time ASC LIMIT 100"

    res = await db.execute(text(query_str), params)
    slots = []
    for row in res.mappings():
        start_dt = row["start_time"]
        end_dt = row["end_time"]
        if isinstance(start_dt, str):
            start_dt = datetime.fromisoformat(start_dt)
        if isinstance(end_dt, str):
            end_dt = datetime.fromisoformat(end_dt)

        cand_label = row["masked_identifier"] or (f"#{row['candidate_id']}" if row["candidate_id"] else "Terbuka")
        role_label = row["job_title"] or "Posisi Rekayasa"
        summary = f"Wawancara {role_label} - {cand_label}"
        desc = (
            f"Kandidat: {cand_label}\n"
            f"Posisi: {role_label}\n"
            f"Pewawancara: {row['interviewer_name']}\n"
            f"Slot ID: {row['id']}\n"
            "Diselenggarakan melalui TalentOps AI."
        )

        google_url = mock_calendar_adapter.generate_google_calendar_url(
            summary=summary,
            start_time=start_dt,
            end_time=end_dt,
            description=desc,
        )

        slots.append({
            "id": row["id"],
            "interviewer_id": row["interviewer_id"],
            "interviewer_name": row["interviewer_name"],
            "candidate_id": row["candidate_id"],
            "masked_identifier": row["masked_identifier"],
            "job_title": row["job_title"],
            "start_time": start_dt.isoformat(),
            "end_time": end_dt.isoformat(),
            "status": row["status"],
            "event_id": row["external_calendar_event_id"],
            "export_google_url": google_url,
            "tag": mock_calendar_adapter.TAG,
        })

    return {
        "status": "success",
        "total": len(slots),
        "data": slots,
        "tag": mock_calendar_adapter.TAG,
    }


@router.get("/available")
async def get_available_slots(
    interviewer_id: Optional[int] = Query(None, description="Filter berdasarkan ID pewawancara"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager", "compliance_officer")),
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
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    PRD Bab 8.2 (Item 13) & Bab 6.3:
    Atomically locks an interview slot to 'tentative' using SELECT ... FOR UPDATE.
    Enforces strict lock hierarchy, anti-double-booking, and interval non-overlap validation.
    Generates deterministic client-generated event ID and direct Google Calendar export link.
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
