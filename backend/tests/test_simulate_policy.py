import asyncio
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock
import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.jobs import (
    PolicySimulationRequest,
    WeightConfigSchema,
    simulate_policy,
)


def test_weight_validation():
    # 1. Valid weights sum to 1.0
    valid_cfg = WeightConfigSchema(SKILL=0.4, EXPERIENCE=0.3, EDUCATION=0.1, PORTFOLIO=0.2)
    assert valid_cfg.SKILL == 0.4

    # 2. Invalid weights (sum != 1.0) must raise ValidationError
    with pytest.raises(ValidationError):
        WeightConfigSchema(SKILL=0.5, EXPERIENCE=0.5, EDUCATION=0.2, PORTFOLIO=0.2)


@pytest.mark.asyncio
async def test_simulate_policy_in_memory():
    # Mock database session
    mock_db = AsyncMock()

    # Job record
    job_row = {
        "id": 1,
        "title": "Senior Backend Engineer",
        "department": "Engineering",
        "weight_config": json.dumps({"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2}),
    }

    # 3 candidates with evaluated dimension scores:
    # Cand 1: Budi (High Skill 100, Exp 90, Edu 60, Port 100) -> Baseline: 40+27+6+20 = 93.0 (STRONG_MATCH)
    # Cand 2: Reza (Skill 60, Exp 80, Edu 60, Port 60) -> Baseline: 24+24+6+12 = 66.0 (REVIEW_REQUIRED)
    # Cand 3: Citra (Skill 0, Exp 20, Edu 20, Port 0) -> Baseline: 0+6+2+0 = 8.0 (WEAK_FIT)
    # Cand 4: Dewi (Skill 100, Exp 80, Edu 60, Port 60, Quarantined Injection) -> Baseline: 76.0 (REVIEW_REQUIRED Aturan 0)
    cand_rows = [
        {
            "id": 1,
            "masked_identifier": "#TK-BUDI01",
            "overall_score": 93.0,
            "dimension_scores": json.dumps({"SKILL": 100.0, "EXPERIENCE": 90.0, "EDUCATION": 60.0, "PORTFOLIO": 100.0}),
            "confidence_level": "HIGH",
            "unresolved_risk": "LOW",
            "recommendation": "STRONG_MATCH",
            "triage_priority": "STANDARD",
        },
        {
            "id": 2,
            "masked_identifier": "#TK-REZA02",
            "overall_score": 66.0,
            "dimension_scores": json.dumps({"SKILL": 60.0, "EXPERIENCE": 80.0, "EDUCATION": 60.0, "PORTFOLIO": 60.0}),
            "confidence_level": "HIGH",
            "unresolved_risk": "LOW",
            "recommendation": "REVIEW_REQUIRED",
            "triage_priority": "STANDARD",
        },
        {
            "id": 3,
            "masked_identifier": "#TK-CITRA03",
            "overall_score": 8.0,
            "dimension_scores": json.dumps({"SKILL": 0.0, "EXPERIENCE": 20.0, "EDUCATION": 20.0, "PORTFOLIO": 0.0}),
            "confidence_level": "LOW",
            "unresolved_risk": "LOW",
            "recommendation": "WEAK_FIT",
            "triage_priority": "STANDARD",
        },
        {
            "id": 4,
            "masked_identifier": "#TK-DEWI04",
            "overall_score": 76.0,
            "dimension_scores": json.dumps({"SKILL": 100.0, "EXPERIENCE": 80.0, "EDUCATION": 60.0, "PORTFOLIO": 60.0}),
            "confidence_level": "HIGH",
            "unresolved_risk": "HIGH",
            "recommendation": "REVIEW_REQUIRED",
            "triage_priority": "HIGH_ATTENTION",
        },
    ]

    def make_mock_result(first_item=None, all_items=None):
        m = MagicMock()
        m.mappings.return_value.first.return_value = first_item
        m.mappings.return_value.all.return_value = all_items or []
        m.fetchall.return_value = [(4,)]  # Dewi candidate_id 4 is quarantined
        return m

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM JOB_DESCRIPTIONS" in sql:
            return make_mock_result(first_item=job_row)
        if "FROM CANDIDATES" in sql:
            return make_mock_result(all_items=cand_rows)
        if "FROM CANDIDATE_ANOMALIES" in sql:
            return make_mock_result()
        return make_mock_result()

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    # Simulation Request:
    # Lower min_overall_score to 75.0 (PRD Bab 8.2 dynamic cut-off)
    # Shift weights to Skill heavy: SKILL=0.6, EXP=0.2, EDU=0.1, PORT=0.1
    # Under new weights:
    # Budi: 100*0.6 + 90*0.2 + 60*0.1 + 100*0.1 = 60 + 18 + 6 + 10 = 94.0 -> STRONG_MATCH
    # Reza: 60*0.6 + 80*0.2 + 60*0.1 + 60*0.1 = 36 + 16 + 6 + 6 = 64.0 -> REVIEW_REQUIRED
    # Dewi: 100*0.6 + 80*0.2 + 60*0.1 + 60*0.1 = 60 + 16 + 6 + 6 = 88.0 -> BUT Quarantined! Must stay REVIEW_REQUIRED (Aturan 0)!
    req = PolicySimulationRequest(
        weights=WeightConfigSchema(SKILL=0.6, EXPERIENCE=0.2, EDUCATION=0.1, PORTFOLIO=0.1),
        min_overall_score=75.0,
    )

    result = await simulate_policy(job_id=1, payload=req, db=mock_db)

    assert result["job_id"] == 1
    assert result["simulation_parameters"]["min_overall_score"] == 75.0
    assert result["simulation_parameters"]["weights"]["SKILL"] == 0.6
    assert result["summary"]["total_evaluated_candidates"] == 4

    ranking = result["ranking"]
    assert len(ranking) == 4
    # Highest simulated score must be first
    assert ranking[0]["masked_identifier"] == "#TK-BUDI01"
    assert ranking[0]["simulated"]["overall_score"] == 94.0
    assert ranking[0]["simulated"]["recommendation"] == "STRONG_MATCH"

    # Dewi has score 88.0 >= 75.0, but injection must force Aturan 0 (REVIEW_REQUIRED, HIGH_ATTENTION)
    dewi_entry = next(c for c in ranking if c["masked_identifier"] == "#TK-DEWI04")
    assert dewi_entry["simulated"]["overall_score"] == 88.0
    assert dewi_entry["simulated"]["recommendation"] == "REVIEW_REQUIRED"
    assert dewi_entry["simulated"]["triage_priority"] == "HIGH_ATTENTION"
    assert "Aturan 0" in dewi_entry["simulated"]["rule_applied"]

    # Citra remains WEAK_FIT
    citra_entry = next(c for c in ranking if c["masked_identifier"] == "#TK-CITRA03")
    assert citra_entry["simulated"]["overall_score"] < 60.0
    assert citra_entry["simulated"]["recommendation"] == "WEAK_FIT"

    print("ALL CHECKS PASSED: What-If Policy Simulation Studio verified 100% in-memory.")


if __name__ == "__main__":
    test_weight_validation()
    asyncio.run(test_simulate_policy_in_memory())
