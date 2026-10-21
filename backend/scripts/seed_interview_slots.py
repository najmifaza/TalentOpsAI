"""Seed interview slots so the HITL scheduling flow has something to book.

No code path in the repository ever INSERTs into `interview_slots` — only
`GET /api/slots/available` and `POST /api/slots/reserve` exist. Without rows here,
the calendar panel renders empty and the approve-and-schedule flow has no slot to
pick, which is exactly what a live demo hits first.

Slots are generated relative to *now* on purpose: hardcoded dates turn stale, and a
past slot can never be booked.

Usage (from backend/):
    ../.venv/bin/python scripts/seed_interview_slots.py
    ../.venv/bin/python scripts/seed_interview_slots.py --days 7 --per-day 4
"""
import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine, text

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.app.core.config import settings

# Business hours only; interviewers are humans, not cron jobs.
SLOT_START_HOURS = (9, 11, 14, 16)
SLOT_LENGTH_MINUTES = 60


def build_slots(days: int, per_day: int) -> list[dict]:
    """Working-day slots starting tomorrow, never in the past."""
    slots = []
    day = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    hours = SLOT_START_HOURS[:per_day] if per_day <= len(SLOT_START_HOURS) else SLOT_START_HOURS
    while len(slots) < days * len(hours):
        day += timedelta(days=1)
        if day.weekday() >= 5:  # skip Sat/Sun
            continue
        for hour in hours:
            start = day.replace(hour=hour)
            slots.append({
                "start_time": start,
                "end_time": start + timedelta(minutes=SLOT_LENGTH_MINUTES),
            })
    return slots


def seed_slots(days: int, per_day: int, interviewer_id: int) -> None:
    engine = create_engine(settings.SYNC_DATABASE_URL, isolation_level="AUTOCOMMIT")
    slots = build_slots(days, per_day)

    with engine.connect() as conn:
        interviewer = conn.execute(
            text("SELECT id FROM users WHERE id = :uid"), {"uid": interviewer_id}
        ).first()
        if not interviewer:
            raise SystemExit(
                f"Interviewer id {interviewer_id} not found. Run scripts/seed_data.py first."
            )

        # uq_interviewer_slot (interviewer_id, start_time) makes this idempotent:
        # re-running never duplicates, and existing bookings are left untouched.
        inserted = 0
        for slot in slots:
            res = conn.execute(
                text("""
                    INSERT INTO interview_slots (interviewer_id, start_time, end_time, status)
                    VALUES (:interviewer_id, :start_time, :end_time, 'available')
                    ON DUPLICATE KEY UPDATE id = id
                """),
                {"interviewer_id": interviewer_id, **slot},
            )
            inserted += res.rowcount or 0

        total = conn.execute(text("SELECT COUNT(*) FROM interview_slots")).scalar()
        available = conn.execute(
            text("SELECT COUNT(*) FROM interview_slots WHERE status = 'available'")
        ).scalar()
        upcoming = conn.execute(
            text("SELECT COUNT(*) FROM interview_slots WHERE start_time > NOW()")
        ).scalar()

    print(f"Inserted: {inserted} new slot(s)")
    print(f"Total slots: {total} | available: {available} | in the future: {upcoming}")
    if upcoming == 0:
        print("WARNING: no future slots — the calendar panel will look empty.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed interview slots for the HITL flow.")
    parser.add_argument("--days", type=int, default=10, help="working days to fill (default 10)")
    parser.add_argument("--per-day", type=int, default=4, help="slots per day (default 4)")
    parser.add_argument("--interviewer", type=int, default=1, help="users.id of the interviewer")
    args = parser.parse_args()
    seed_slots(args.days, args.per_day, args.interviewer)
