import asyncio
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.llm_adapter import (
    LLMAdapter,
    LLMAdapterError,
    PRE_CACHED_STORE,
    compute_file_hash,
    register_pre_cached_fixture,
)
from app.core.triage_service import AgentTriageService
from app.schemas.extraction import CandidateExtractionSchema, AnomalyFlags


@pytest.mark.asyncio
async def test_llm_adapter_model_fallback_on_throttling():
    """
    PRD Bab 5.1 & Sprint 5:
    When primary model returns HTTP 429/503 or fails, adapter must failover
    to LLM_FALLBACK_MODEL before exhausting retries.
    """
    adapter = LLMAdapter(base_url="http://mocked-gateway.local/v1", api_key="test-key")

    call_count = 0

    def mock_post_handler(url, headers=None, json=None):
        nonlocal call_count
        call_count += 1
        model_requested = str((json or {}).get("model", ""))
        # Primary model fails with 429 Too Many Requests
        if "flash-low" in model_requested or call_count <= 3:
            return httpx.Response(status_code=429, text="Rate limit exceeded")
        # Fallback model succeeds
        return httpx.Response(
            status_code=200,
            json={
                "choices": [
                    {"message": {"content": "{\"claims\": [], \"career_timeline\": [], \"anomalies\": {}}"}}
                ]
            },
        )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [
            httpx.Response(status_code=429, text="Rate limit exceeded"),  # attempt 1 primary
            httpx.Response(status_code=429, text="Rate limit exceeded"),  # attempt 2 primary
            httpx.Response(status_code=429, text="Rate limit exceeded"),  # attempt 3 primary
            httpx.Response(status_code=200, json={                         # fallback model succeeds
                "choices": [{"message": {"content": "SUCCESS_FALLBACK"}}]
            }),
        ]

        res = await adapter.complete(
            messages=[{"role": "user", "content": "ping"}],
            use_cache=False,
            model="ag/gemini-3.8-flash-low",
        )
        assert res["source"] == "LIVE"
        assert res["content"] == "SUCCESS_FALLBACK"
        print("Model Fallback on 429 Throttling: Verified successfully.")


@pytest.mark.asyncio
async def test_llm_adapter_pre_cached_fallback_on_total_gateway_outage():
    """
    PRD Bab 5.1 Safe Pre-Cached Mode:
    When the gateway is completely offline or unreachable (httpx.ConnectError),
    and file_hash is known in pre-cached store, adapter returns PRE_CACHED_FALLBACK
    with label [PRE-CACHED] without crashing or raising unhandled exception.
    """
    fake_hash = "mock_hash_offline_test"
    cached_payload = {
        "claims": [{"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True}],
        "career_timeline": [],
        "anomalies": {},
    }
    register_pre_cached_fixture(fake_hash, cached_payload)

    # Point to non-existent port to guarantee network connection refusal
    adapter = LLMAdapter(base_url="http://127.0.0.1:59999/v1", api_key="test-key")

    res = await adapter.complete(
        messages=[{"role": "user", "content": "extract"}],
        file_hash=fake_hash,
        use_cache=False,  # Bypass direct cache, force live attempt to trigger network failure
    )

    assert res["source"] == "PRE_CACHED_FALLBACK"
    assert res["label"] == "[PRE-CACHED]"
    assert res["model"] == "cache_fallback"
    assert res["parsed"]["claims"][0]["technology"] == "FastAPI"
    print("Pre-Cached Fallback on Gateway Outage: Verified gracefully without crash.")


@pytest.mark.asyncio
async def test_triage_pipeline_bounded_self_healing_on_malformed_llm_json():
    """
    PRD Bab 5.3 Bounded Self-Healing:
    When LLM returns corrupted or truncated non-JSON string, triage service catches
    the decode error, engages heuristic fallback schema, and completes triage
    without throwing a 500 Internal Server Error.
    """
    service = AgentTriageService()
    mock_db = AsyncMock()

    mock_cand_row = {
        "id": 99,
        "job_id": 1,
        "masked_identifier": "#TK-HEAL01",
        "sanitized_resume_text": "Backend Engineer with Python and PostgreSQL experience.",
        "file_hash_sha256": "non_cached_hash_xyz",
        "resume_file_path": "corrupt.docx",
        "status": "queued",
        "job_title": "Backend Engineer",
        "department": "Engineering",
        "core_competencies": ["FastAPI", "PostgreSQL"],
        "weight_config": {"SKILL": 0.5, "EXPERIENCE": 0.5, "EDUCATION": 0.0, "PORTFOLIO": 0.0},
    }

    def make_mappings(data):
        m = MagicMock()
        m.mappings.return_value.first.return_value = data
        m.mappings.return_value.all.return_value = [data] if data else []
        return m

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql and "JOIN JOB_DESCRIPTIONS" in sql:
            return make_mappings(mock_cand_row)
        if "FROM CANDIDATE_ANOMALIES" in sql:
            return make_mappings(None)
        if "FROM INTERVIEW_SLOTS" in sql and "AVAILABLE" in sql:
            return make_mappings({"id": 1, "interviewer_id": 1})
        return make_mappings(None)

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    # LLM returns malformed/truncated garbage text instead of valid JSON
    service.llm_adapter.complete = AsyncMock(return_value={
        "source": "LIVE",
        "content": "MALFORMED_OUTPUT_ERROR_INTERNAL_502_BAD_GATEWAY{{{not_valid_json...",
    })

    result = await service.execute_triage(candidate_id=99, db=mock_db, use_cache=False)

    # Assert bounded self-healing: pipeline survives and sets safe recommendation
    assert result["candidate_id"] == 99
    assert result["masked_identifier"] == "#TK-HEAL01"
    assert "recommendation" in result
    assert result["recommendation"] in ("REVIEW_REQUIRED", "WEAK_FIT")
    assert result["total_duration_ms"] > 0
    print("Bounded Self-Healing on Malformed Output: Pipeline executed safely with zero crash.")


@pytest.mark.asyncio
async def test_unrecoverable_failure_raises_adapter_error_when_no_cache():
    """
    Verify that when gateway is offline AND file_hash is not in cache,
    adapter cleanly raises LLMAdapterError for caller visibility.
    """
    with patch("app.core.config.settings.LLM_TIMEOUT", 0.1), patch("app.core.config.settings.LLM_MAX_RETRIES", 1):
        adapter = LLMAdapter(base_url="http://127.0.0.1:59998/v1")
        with pytest.raises(LLMAdapterError):
            await adapter.complete(
                messages=[{"role": "user", "content": "test"}],
                file_hash="unknown_uncached_hash_999",
                use_cache=False,
            )
    print("Unrecoverable Gateway Failure: Cleanly raises LLMAdapterError.")


def test_heuristic_fallback_extraction_engine():
    """
    Verify that _extract_heuristic_fallback successfully parses real competencies,
    surrounding sentence quotes, metrics, timeline, and education from resume text.
    """
    from app.core.triage_service import _extract_heuristic_fallback

    sample_cv = (
        "Budi Santoso - Senior Frontend Engineer\n"
        "Jakarta | github.com/budisantoso | https://budisantoso.dev\n"
        "Frontend Engineer berpengalaman 4+ tahun dalam membangun web apps dengan React, TypeScript, Tailwind CSS, dan Next.js.\n"
        "Mampu meningkatkan performa web hingga 45% dan memimpin deployment CI/CD.\n"
        "PENGALAMAN KERJA\n"
        "PT Solusi Digital - Senior Frontend Developer (2021-01 s/d present)\n"
        "- Memimpin arsitektur antarmuka React dan Next.js untuk jutaan user harian.\n"
        "PT Inovasi Kode - Frontend Developer (2019-06 s/d 2020-12)\n"
        "- Mengembangkan dashboard visualisasi React Flow.\n"
        "PENDIDIKAN\n"
        "S1 Teknik Informatika - Lulus"
    )

    core_comp = ["React", "TypeScript", "Tailwind CSS", "Next.js", "CI/CD"]
    schema = _extract_heuristic_fallback(
        sanitized_text=sample_cv,
        core_competencies=core_comp,
        job_title="Senior Frontend Engineer",
        is_tech_role=True,
    )

    assert len(schema.claims) >= 4
    techs = [c.technology for c in schema.claims]
    assert "React" in techs
    assert "TypeScript" in techs
    assert "Next.js" in techs

    # Substring guard must pass verbatim match for extracted claims
    schema.apply_substring_guard(sample_cv)
    verified = [c for c in schema.claims if c.has_implementation_detail]
    assert len(verified) >= 3

    assert len(schema.career_timeline) >= 2
    assert schema.education is not None
    assert schema.education.degree == "S1"
    assert "Informatika" in schema.education.field_of_study
    assert schema.github_url == "https://github.com/budisantoso"
    assert schema.portfolio_url == "https://budisantoso.dev"
