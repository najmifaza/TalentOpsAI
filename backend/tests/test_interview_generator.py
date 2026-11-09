"""
Item #3 — LLM-generated adaptive interview questions (docs/RENCANA_PENGEMBANGAN_AI.md §6).

Two contracts matter here: a model-invented skill must never reach the database, and
`difficulty_level` must always land inside the MariaDB ENUM (STRICT_TRANS_TABLES aborts
the whole triage transaction on a bad value).
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.interview_generator import VALID_DIFFICULTY, generate_interview_questions

CLAIMS = [
    {
        "dimension": "SKILL",
        "technology": "FastAPI",
        "has_implementation_detail": True,
        "context_narrative": "Membangun layanan FastAPI untuk 40 endpoint",
    },
    {
        "dimension": "SKILL",
        "technology": "Redis",
        "has_implementation_detail": False,
        "context_narrative": None,
    },
]
CORE = ["FastAPI", "Redis", "Docker"]


class _FakeLLM:
    def __init__(self, payload=None, raises=None):
        self.payload = payload
        self.raises = raises

    async def complete(self, **kwargs):
        if self.raises:
            raise self.raises
        return {"content": json.dumps(self.payload), "model": "fake-model", "source": "LIVE"}


def _question(**overrides):
    base = {
        "target_skill": "Redis",
        "difficulty_level": "L2_SYSTEM_DESIGN",
        "scenario_question": "Bagaimana Anda menjaga konsistensi cache Redis saat gagal?",
        "evaluation_criteria": "Menyebut strategi invalidation dan penanganan race.",
        "follow_ups": ["Apa metrik yang Anda pantau?", "Bagaimana rollback-nya?"],
    }
    base.update(overrides)
    return base


async def _generate(llm):
    return await generate_interview_questions(
        llm,
        job_title="Senior Backend Engineer",
        core_competencies=CORE,
        claims=CLAIMS,
        evidence_records=[
            {"target_competency": "Redis", "matched_requirement": "Redis", "verified": False, "score_contribution": 0.0}
        ],
        anomaly_details=[],
        recommendation="REVIEW_REQUIRED",
        dimension_scores={"SKILL": 62.0},
    )


@pytest.mark.asyncio
async def test_valid_payload_is_accepted_and_follow_ups_folded_in():
    result = await _generate(_FakeLLM({"questions": [_question()]}))

    assert result is not None
    assert result["model"] == "fake-model"
    question = result["questions"][0]
    assert question["target_skill"] == "Redis"
    assert question["difficulty_level"] in VALID_DIFFICULTY
    # No `follow_up_questions` column exists, so follow-ups ride inside the question text.
    assert "Pertanyaan lanjutan:" in question["scenario_question"]
    assert "1. Apa metrik yang Anda pantau?" in question["scenario_question"]


@pytest.mark.asyncio
async def test_unknown_skill_is_dropped():
    """The model must not invent a topic the job or CV never mentioned."""
    result = await _generate(
        _FakeLLM({"questions": [_question(target_skill="Kubernetes Operators")]})
    )
    assert result is None


@pytest.mark.asyncio
async def test_skill_spelling_is_canonicalised():
    result = await _generate(_FakeLLM({"questions": [_question(target_skill="fastapi")]}))
    assert result["questions"][0]["target_skill"] == "FastAPI"


@pytest.mark.asyncio
async def test_unknown_difficulty_falls_back_inside_the_enum():
    result = await _generate(_FakeLLM({"questions": [_question(difficulty_level="sangat sulit")]}))
    assert result["questions"][0]["difficulty_level"] in VALID_DIFFICULTY


@pytest.mark.asyncio
async def test_short_difficulty_alias_is_resolved():
    result = await _generate(_FakeLLM({"questions": [_question(difficulty_level="l3")]}))
    assert result["questions"][0]["difficulty_level"] == "L3_EDGE_CASE"


@pytest.mark.asyncio
async def test_malformed_payload_returns_none_for_template_fallback():
    assert await _generate(_FakeLLM({"questions": "bukan list"})) is None
    assert await _generate(_FakeLLM({"unexpected": []})) is None


@pytest.mark.asyncio
async def test_gateway_failure_returns_none():
    assert await _generate(_FakeLLM(raises=RuntimeError("gateway down"))) is None


@pytest.mark.asyncio
async def test_question_blocked_by_moderation_is_dropped():
    result = await _generate(
        _FakeLLM({"questions": [_question(scenario_question="Dasar bodoh, jelaskan Redis Anda.")]})
    )
    assert result is None


@pytest.mark.asyncio
async def test_question_count_is_capped():
    payload = {"questions": [_question(target_skill=skill) for skill in ["FastAPI", "Redis", "Docker"] * 3]}
    result = await _generate(_FakeLLM(payload))
    assert len(result["questions"]) <= 4


@pytest.mark.asyncio
async def test_no_allowed_skills_short_circuits():
    result = await generate_interview_questions(
        _FakeLLM({"questions": [_question()]}),
        job_title="Posisi",
        core_competencies=[],
        claims=[],
        evidence_records=[],
    )
    assert result is None

@pytest.mark.asyncio
async def test_service_wiring_uses_generated_questions_and_records_step():
    """Integration seam: `_generate_adaptive_assessments` must swap in LLM questions."""
    from unittest.mock import AsyncMock

    from app.core.triage_service import AgentTriageService
    from app.schemas.extraction import CandidateExtractionSchema

    schema = CandidateExtractionSchema.model_validate(
        {"claims": CLAIMS, "career_timeline": [], "education": {"degree": "S1", "field_of_study": "Informatika"}}
    )
    service = AgentTriageService()
    service.llm_adapter = _FakeLLM({"questions": [_question()]})

    db = AsyncMock()
    assessment = {
        "adaptive_challenges": [
            {
                "target_skill": "FastAPI",
                "difficulty_level": "L1_FUNDAMENTAL",
                "scenario_question": "template lama",
                "evaluation_criteria": "template lama",
            }
        ],
        "evidence_records": [],
        "anomaly_details": [],
        "recommendation": "REVIEW_REQUIRED",
        "dimension_scores": {"SKILL": 62.0},
    }

    questions = await service._generate_adaptive_assessments(
        schema=schema,
        assessment=assessment,
        job_title="Senior Backend Engineer",
        core_competencies=CORE,
        run_id="run-test",
        candidate_id=1,
        masked_id="#TK-TEST",
        db=db,
    )

    assert questions[0]["scenario_question"].startswith("Bagaimana Anda menjaga")
    inserted_sql = [str(call.args[0]) for call in db.execute.await_args_list]
    assert any("agent_steps" in sql for sql in inserted_sql)
