"""
Item #4 — dual-model extraction cross-check (docs/RENCANA_PENGEMBANGAN_AI.md §5).

Agreement is a stability signal, not a truth score: two models can agree and both be
wrong. What the tests pin is the behaviour on divergence — confidence drops, priority
escalates, and the trace records why.
"""
import json
import os
import sys
from unittest.mock import AsyncMock

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.crosscheck import (
    DIVERGENCE_THRESHOLD,
    build_divergence_anomaly,
    compare_extractions,
    downgrade_confidence,
)
from app.core.triage_service import AgentTriageService
from app.schemas.extraction import CandidateExtractionSchema


def _schema(technologies, jobs=1, anomalies=None):
    return CandidateExtractionSchema.model_validate(
        {
            "claims": [
                {
                    "dimension": "SKILL",
                    "technology": tech,
                    "has_implementation_detail": True,
                    "context_narrative": f"memakai {tech}",
                }
                for tech in technologies
            ],
            "career_timeline": [
                {
                    "role": f"Engineer {i}",
                    "company": "PT Contoh",
                    "is_relevant_role": True,
                    "employment_type": "full_time",
                    "start": "2022-01",
                    "end": "2023-01",
                }
                for i in range(jobs)
            ],
            "education": {"degree": "S1", "field_of_study": "Informatika", "graduation_status": "Lulus"},
            "anomalies": anomalies or {},
        }
    )


def test_identical_extractions_agree_fully():
    primary = _schema(["FastAPI", "Docker", "PostgreSQL"])
    secondary = _schema(["FastAPI", "Docker", "PostgreSQL"])

    result = compare_extractions(primary, secondary)
    assert result["agreement"] == 1.0
    assert result["divergent"] is False
    assert result["divergences"] == []


def test_divergent_skills_fall_below_threshold():
    primary = _schema(["FastAPI", "Docker", "PostgreSQL"])
    secondary = _schema(["React", "Figma", "Copywriting"])

    result = compare_extractions(primary, secondary)
    assert result["agreement"] < DIVERGENCE_THRESHOLD
    assert result["divergent"] is True
    assert any("model utama" in d for d in result["divergences"])


def test_technology_aliases_compare_equal():
    """normalize_technology_key collapses dots/case: Next.js == nextjs."""
    primary = _schema(["Next.js"])
    secondary = _schema(["NEXTJS"])
    assert compare_extractions(primary, secondary)["skill_agreement"] == 1.0


def test_timeline_length_difference_is_partial_agreement():
    result = compare_extractions(_schema(["Docker"], jobs=2), _schema(["Docker"], jobs=3))
    assert result["timeline_agreement"] == 0.5
    assert any("riwayat kerja" in d.lower() for d in result["divergences"])


def test_confidence_downgrade_walks_the_enum():
    assert downgrade_confidence("HIGH") == "MEDIUM"
    assert downgrade_confidence("MEDIUM") == "LOW"
    assert downgrade_confidence("LOW") == "LOW"
    assert downgrade_confidence(None) == "LOW"


def test_divergence_anomaly_row_is_actionable():
    result = compare_extractions(_schema(["FastAPI"]), _schema(["React"]))
    anomaly = build_divergence_anomaly(result, {"primary": "model-a", "crosscheck": "model-b"})

    assert anomaly["type"] == "LOW_CONFIDENCE_EXTRACTION"
    assert anomaly["severity"] in {"LOW", "MEDIUM", "HIGH"}
    assert "model-a" in anomaly["suggested_verification"]
    assert "model-b" in anomaly["suggested_verification"]


@pytest.mark.asyncio
async def test_extraction_pair_runs_both_models_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "DUAL_MODEL_VERIFY", True)
    service = AgentTriageService()
    service.llm_adapter.complete = AsyncMock(
        side_effect=[
            {"source": "LIVE", "model": "model-a", "content": json.dumps({"claims": []})},
            {"source": "LIVE", "model": "model-b", "content": json.dumps({"claims": []})},
        ]
    )

    primary, secondary = await service._run_extraction_pair([], "hash", True)
    assert primary["model"] == "model-a"
    assert secondary["model"] == "model-b"
    assert service.llm_adapter.complete.await_count == 2


@pytest.mark.asyncio
async def test_extraction_pair_survives_dead_crosscheck(monkeypatch):
    monkeypatch.setattr(settings, "DUAL_MODEL_VERIFY", True)
    service = AgentTriageService()
    service.llm_adapter.complete = AsyncMock(
        side_effect=[
            {"source": "LIVE", "model": "model-a", "content": json.dumps({"claims": []})},
            RuntimeError("cross-check model down"),
        ]
    )

    primary, secondary = await service._run_extraction_pair([], "hash", True)
    assert primary["model"] == "model-a"
    assert secondary is None


@pytest.mark.asyncio
async def test_primary_failure_propagates(monkeypatch):
    """The cross-check must never mask a dead primary: that path has its own fallback."""
    monkeypatch.setattr(settings, "DUAL_MODEL_VERIFY", True)
    service = AgentTriageService()
    service.llm_adapter.complete = AsyncMock(
        side_effect=[RuntimeError("primary down"), {"source": "LIVE", "content": "{}"}]
    )

    with pytest.raises(RuntimeError):
        await service._run_extraction_pair([], "hash", True)


@pytest.mark.asyncio
async def test_pre_cached_extraction_skips_crosscheck(monkeypatch):
    """Comparing a cache hit against a live call measures the cache, not the model."""
    monkeypatch.setattr(settings, "DUAL_MODEL_VERIFY", True)
    service = AgentTriageService()
    service.llm_adapter.complete = AsyncMock(
        return_value={"source": "PRE_CACHED", "model": "cache", "content": json.dumps({"claims": []})}
    )

    primary, secondary = await service._run_extraction_pair([], "hash", True)
    assert primary["source"] == "PRE_CACHED"
    assert secondary is None


@pytest.mark.asyncio
async def test_flag_off_restores_single_model(monkeypatch):
    monkeypatch.setattr(settings, "DUAL_MODEL_VERIFY", False)
    service = AgentTriageService()
    service.llm_adapter.complete = AsyncMock(
        return_value={"source": "LIVE", "model": "model-a", "content": json.dumps({"claims": []})}
    )

    primary, secondary = await service._run_extraction_pair([], "hash", True)
    assert secondary is None
    assert service.llm_adapter.complete.await_count == 1

@pytest.mark.asyncio
async def test_registered_fixture_skips_crosscheck_without_extra_call(monkeypatch):
    """Demo fixtures must not burn a gateway call on a comparison that cannot vary."""
    from app.core.llm_adapter import register_pre_cached_fixture

    monkeypatch.setattr(settings, "DUAL_MODEL_VERIFY", True)
    register_pre_cached_fixture("fixture-hash", {"claims": []})

    service = AgentTriageService()
    service.llm_adapter.complete = AsyncMock(
        return_value={"source": "PRE_CACHED", "model": "cache", "content": json.dumps({"claims": []})}
    )

    primary, secondary = await service._run_extraction_pair([], "fixture-hash", True)
    assert secondary is None
    assert service.llm_adapter.complete.await_count == 1
