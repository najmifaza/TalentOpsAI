"""Pins candidate_assessments.difficulty_level to the values in migration 001.

The scoring engine once emitted "L2_CASE_STUDY", a literal absent from the ENUM.
Mocks and SQLite accepted it, so the suite stayed green while MariaDB
(STRICT_TRANS_TABLES) would have rejected the INSERT and killed the whole triage run
for every HIGH-risk candidate. Both sides of the contract are checked here.
"""

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.scoring import DeterministicScoringEngine

MIGRATION = Path(__file__).resolve().parent.parent / "migrations" / "001_initial_schema.sql"


def _enum_members(column: str) -> set:
    sql = MIGRATION.read_text(encoding="utf-8")
    match = re.search(column + r"\s+ENUM\((.*?)\)", sql, re.S)
    assert match, f"{column} ENUM not found in {MIGRATION.name}"
    return set(re.findall(r"'([^']+)'", match.group(1)))


def _claims():
    return [
        {
            "dimension": "SKILL",
            "technology": "FastAPI",
            "has_implementation_detail": True,
            "context_narrative": "built async rest microservices using FastAPI handling 2500 rps",
            "metric_string": "handled 2500 rps throughput",
            "repo_url": None,
        }
    ]


def _concurrent_fulltime_timeline():
    return [
        {
            "role": "Backend Engineer", "company": "Company A",
            "start": "2022-01", "end": "2023-12",
            "is_relevant_role": True, "employment_type": "full_time",
        },
        {
            "role": "Lead Architect", "company": "Company B",
            "start": "2022-01", "end": "2023-12",
            "is_relevant_role": True, "employment_type": "full_time",
        },
    ]


def test_high_risk_challenge_difficulty_is_inside_enum():
    result = DeterministicScoringEngine.compute_full_assessment(
        claims=_claims(),
        career_timeline=_concurrent_fulltime_timeline(),
        education=None,
        anomalies={},
        core_competencies=["FastAPI", "Docker"],
        as_of=__import__("datetime").datetime(2024, 1, 1),
    )

    assert result["unresolved_risk"] == "HIGH", "24-month full-time overlap must be HIGH risk"
    challenges = result["adaptive_challenges"]
    assert challenges, "HIGH risk must trigger an adaptive challenge"

    allowed = _enum_members("difficulty_level")
    for challenge in challenges:
        assert challenge["difficulty_level"] in allowed, (
            f"{challenge['difficulty_level']!r} is not in the DB ENUM {sorted(allowed)}"
        )


def test_clean_candidate_challenge_difficulty_is_inside_enum():
    result = DeterministicScoringEngine.compute_full_assessment(
        claims=_claims(),
        career_timeline=[
            {
                "role": "Backend Engineer", "company": "Company A",
                "start": "2020-01", "end": "2024-01",
                "is_relevant_role": True, "employment_type": "full_time",
            }
        ],
        education={"degree": "S1", "field_of_study": "Informatika", "graduation_status": "Lulus"},
        anomalies={},
        core_competencies=["FastAPI", "Docker", "PostgreSQL"],
    )

    allowed = _enum_members("difficulty_level")
    for challenge in result["adaptive_challenges"]:
        assert challenge["difficulty_level"] in allowed


def test_flag_severity_classes():
    from app.core.triage_service import _flag_severity

    assert _flag_severity("CONCURRENT_FULLTIME_OVERLAP_24_MONTHS") == "HIGH"
    assert _flag_severity("PROMPT_INJECTION") == "HIGH"
    assert _flag_severity("SECURITY_INSPECTION_FAILED") == "HIGH"
    assert _flag_severity("CAREER_BREAK_FLAG") == "LOW"
    assert _flag_severity("TITLE_INFLATION_DETECTED") == "MEDIUM"


def test_reserve_with_recovery_skips_slots_lost_to_a_race():
    """PRD Bab 5.3 Siklus 6: a concurrent booking must not end the triage run."""
    import asyncio

    from app.core.triage_service import CALENDAR_RECOVERY_ATTEMPTS, reserve_with_recovery

    class _FakeAdapter:
        def __init__(self, failures):
            self.failures = failures
            self.calls = []

        async def reserve_slot(self, db, slot_id, candidate_id, interviewer_id):
            self.calls.append(slot_id)
            reason = self.failures.get(slot_id)
            if reason:
                return {"success": False, "reason": reason}
            return {"success": True, "slot_id": slot_id}

    slots = [{"id": 1, "interviewer_id": 7}, {"id": 2, "interviewer_id": 7}, {"id": 3, "interviewer_id": 7}]

    adapter = _FakeAdapter({1: "SLOT_ALREADY_TENTATIVE", 2: "INTERVIEWER_SCHEDULE_CONFLICT_OVERLAP"})
    reserved, slot_id, conflicts, last_reason = asyncio.run(
        reserve_with_recovery(adapter, db=None, candidate_id=99, slot_rows=slots)
    )
    assert (reserved, slot_id, conflicts) == (True, 3, 2)
    assert last_reason == "INTERVIEWER_SCHEDULE_CONFLICT_OVERLAP"
    assert adapter.calls == [1, 2, 3]

    # Every slot taken: reported as a counted conflict, not an exception.
    adapter = _FakeAdapter({1: "SLOT_ALREADY_BOOKED", 2: "SLOT_ALREADY_BOOKED", 3: "SLOT_ALREADY_BOOKED"})
    reserved, slot_id, conflicts, _ = asyncio.run(
        reserve_with_recovery(adapter, db=None, candidate_id=99, slot_rows=slots)
    )
    assert (reserved, slot_id, conflicts) == (False, None, 3)

    # A non-conflict failure stops the walk instead of burning retries.
    adapter = _FakeAdapter({1: "SLOT_NOT_FOUND"})
    reserved, slot_id, conflicts, last_reason = asyncio.run(
        reserve_with_recovery(adapter, db=None, candidate_id=99, slot_rows=slots)
    )
    assert (reserved, conflicts, last_reason) == (False, 0, "SLOT_NOT_FOUND")
    assert adapter.calls == [1]

    # Attempts are bounded.
    adapter = _FakeAdapter({s["id"]: "SLOT_ALREADY_BOOKED" for s in slots})
    asyncio.run(reserve_with_recovery(adapter, db=None, candidate_id=99, slot_rows=slots, attempts=2))
    assert adapter.calls == [1, 2]
    assert CALENDAR_RECOVERY_ATTEMPTS > 1
