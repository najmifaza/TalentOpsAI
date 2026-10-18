import asyncio
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.triage_service import AgentTriageService
from app.core.broadcaster import sse_broadcaster


async def run_pipeline_check():
    service = AgentTriageService()

    # Mock Candidate & Job in DB
    mock_db = AsyncMock()
    mock_cand_row = {
        "id": 1,
        "job_id": 1,
        "masked_identifier": "#TK-TEST01",
        "sanitized_resume_text": "Experienced Python Backend Engineer with FastAPI, PostgreSQL, Docker, Redis, and CI/CD handling 2500 rps.",
        "file_hash_sha256": "mock_file_hash_sha256",
        "resume_file_path": "budi.docx",
        "status": "queued",
        "job_title": "Senior Backend Engineer",
        "department": "Engineering",
        "core_competencies": ["FastAPI", "Docker", "PostgreSQL", "CI/CD", "Redis"],
        "weight_config": {"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2},
    }

    # Setup mock query results
    def make_mappings(data):
        m = MagicMock()
        m.mappings.return_value.first.return_value = data
        m.mappings.return_value.__iter__.return_value = [data] if data else []
        return m

    # Dynamic mock execute router based on SQL content
    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql and "JOIN JOB_DESCRIPTIONS" in sql:
            return make_mappings(mock_cand_row)
        if "FROM CANDIDATE_ANOMALIES" in sql:
            return make_mappings(None)
        if "FROM INTERVIEW_SLOTS" in sql and "AVAILABLE" in sql:
            return make_mappings({"id": 10, "interviewer_id": 2})
        return make_mappings(None)

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    # Mock LLM Adapter
    service.llm_adapter.complete = AsyncMock(return_value={
        "source": "LIVE",
        "content": json.dumps({
            "claims": [
                {
                    "dimension": "SKILL",
                    "technology": "FastAPI",
                    "has_implementation_detail": True,
                    "context_narrative": "Experienced Python Backend Engineer with FastAPI",
                    "metric_string": "handling 2500 rps",
                    "repo_url": "https://github.com/candidate/repo",
                },
                {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True, "context_narrative": "Docker"},
                {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True, "context_narrative": "PostgreSQL"},
                {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True, "context_narrative": "CI/CD"},
                {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True, "context_narrative": "Redis"},
            ],
            "career_timeline": [
                {"role": "Backend Engineer", "company": "Tech Corp", "start": "2019-01", "end": "2024-06", "is_relevant_role": True}
            ],
            "education": {"degree": "S1", "field_of_study": "Informatika", "graduation_status": "Lulus"},
            "anomalies": {"prompt_injection_detected": False, "hidden_text_detected": False, "notes": []},
        })
    })

    # Mock GitHub Adapter
    service.github_adapter.verify_repository = AsyncMock(return_value={
        "valid": True,
        "verified": True,
        "is_fork": False,
        "primary_language": "Python",
        "stars_count": 10,
    })

    # Mock Calendar Adapter
    service.calendar_adapter.reserve_slot = AsyncMock(return_value={"success": True, "slot_id": 10})

    result = await service.execute_triage(candidate_id=1, db=mock_db, use_cache=False)

    assert result["candidate_id"] == 1
    assert result["masked_identifier"] == "#TK-TEST01"
    assert result["overall_score"] >= 80.0
    assert result["recommendation"] in ("STRONG_MATCH", "REVIEW_REQUIRED")
    assert result["total_duration_ms"] > 0

    print("ALL CHECKS PASSED: Agent Triage Service Pipeline validated end-to-end.")


if __name__ == "__main__":
    asyncio.run(run_pipeline_check())
