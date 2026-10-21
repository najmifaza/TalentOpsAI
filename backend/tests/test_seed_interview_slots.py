"""Guards for scripts/seed_interview_slots.py — slot generation must never emit past dates."""
import sys
from datetime import datetime
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from scripts.seed_interview_slots import SLOT_LENGTH_MINUTES, build_slots


def test_slots_are_in_the_future():
    """A past slot can never be booked, so the seed must be relative to now."""
    slots = build_slots(days=5, per_day=4)
    now = datetime.now()
    assert slots, "generator produced no slots"
    assert all(s["start_time"] > now for s in slots)


def test_slots_skip_weekends():
    slots = build_slots(days=10, per_day=4)
    assert all(s["start_time"].weekday() < 5 for s in slots)


def test_slot_duration_and_count():
    slots = build_slots(days=3, per_day=4)
    assert len(slots) == 12
    for slot in slots:
        delta = slot["end_time"] - slot["start_time"]
        assert delta.total_seconds() == SLOT_LENGTH_MINUTES * 60


def test_no_duplicate_start_times():
    """uq_interviewer_slot would reject duplicates, so the generator must not emit them."""
    slots = build_slots(days=10, per_day=4)
    starts = [s["start_time"] for s in slots]
    assert len(starts) == len(set(starts))
