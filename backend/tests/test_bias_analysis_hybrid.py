"""
Item #5 — hybrid job-description bias audit (docs/RENCANA_PENGEMBANGAN_AI.md §7).

The regex layer stays authoritative: reproducible, unit-testable, and the only layer that
runs when the gateway is down. The LLM layer adds implicit wording. Both must feed the
same scorer — `inclusivity_from_findings` — or the audit endpoint and the public career
portal can disagree about the same job.
"""
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from app.api import jobs as jobs_api
from app.core.auth import create_access_token
from app.core.config import settings
from app.core.database import get_db
from app.core.scoring import inclusivity_from_findings
from app.main import app

client = TestClient(app)

IMPLICIT_AD_TEXT = (
    "Kami mencari kandidat energik dan single yang culture fit dengan tim muda "
    "untuk mengembangkan produk internal."
)


def _auth_headers(role: str = "admin") -> dict:
    token = create_access_token({"sub": "1", "role": role, "username": f"{role}_test"})
    return {"Authorization": f"Bearer {token}"}


class _FakeAdapter:
    def __init__(self, payload=None, raises=None):
        self.payload = payload
        self.raises = raises
        self.calls = 0

    async def complete(self, **kwargs):
        self.calls += 1
        if self.raises:
            raise self.raises
        return {"content": json.dumps(self.payload), "model": "fake", "source": "LIVE"}


LLM_FINDING = {
    "category": "GENDER_EXCLUSIVE_TERMS",
    "severity": "HIGH",
    "matched_term": "energik dan single",
    "actionable_suggestion": "Hapus rujukan status perkawinan; sebutkan kebutuhan kolaborasi tim.",
}


@pytest.fixture(autouse=True)
def _enable_llm_layer(monkeypatch):
    monkeypatch.setattr(settings, "BIAS_LLM_ANALYSIS", True)
    jobs_api._bias_llm_cache.clear()
    yield
    jobs_api._bias_llm_cache.clear()


def test_invented_term_is_dropped():
    """A quote the model made up must not reach the recruiter."""
    finding = jobs_api._normalize_llm_bias_finding(
        {**LLM_FINDING, "matched_term": "wajib lajang dan berpenampilan menarik"},
        IMPLICIT_AD_TEXT,
    )
    assert finding is None


def test_verbatim_term_is_kept_with_context():
    finding = jobs_api._normalize_llm_bias_finding(LLM_FINDING, IMPLICIT_AD_TEXT)
    assert finding is not None
    assert finding["matched_term"] == "energik dan single"
    assert finding["category"] == "GENDER_EXCLUSIVE_TERMS"
    assert finding["severity"] == "HIGH"
    assert finding["detected_by"] == "LLM"
    assert "energik dan single" in finding["context_snippet"]


def test_merge_prefers_regex_findings_on_collision():
    rule = {
        "category": "GENDER_EXCLUSIVE_TERMS",
        "severity": "HIGH",
        "matched_term": "Energik dan Single",
        "context_snippet": "...regex...",
        "actionable_suggestion": "Gunakan padanan netral.",
    }
    merged = jobs_api._merge_bias_findings([rule], [jobs_api._normalize_llm_bias_finding(LLM_FINDING, IMPLICIT_AD_TEXT)])
    assert len(merged) == 1
    assert merged[0]["context_snippet"] == "...regex..."


@pytest.mark.asyncio
async def test_llm_layer_caches_by_text_hash(monkeypatch):
    adapter = _FakeAdapter({"findings": [LLM_FINDING]})
    monkeypatch.setattr(jobs_api, "LLMAdapter", lambda: adapter)

    first, mode = await jobs_api._llm_bias_findings(IMPLICIT_AD_TEXT)
    second, _ = await jobs_api._llm_bias_findings(IMPLICIT_AD_TEXT)

    assert mode == "HYBRID"
    assert len(first) == 1 == len(second)
    assert adapter.calls == 1


@pytest.mark.asyncio
async def test_llm_outage_returns_rules_only(monkeypatch):
    monkeypatch.setattr(jobs_api, "LLMAdapter", lambda: _FakeAdapter(raises=RuntimeError("down")))
    findings, mode = await jobs_api._llm_bias_findings(IMPLICIT_AD_TEXT)
    assert findings == []
    assert mode == "RULES_ONLY"


def _mock_db(raw_text: str):
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.mappings.return_value.first.return_value = {
        "id": 1,
        "title": "Backend Engineer",
        "department": "Engineering",
        "raw_text": raw_text,
        "flagged_ambiguities": None,
    }
    mock_db.execute = AsyncMock(return_value=mock_res)
    return mock_db


def _post_bias(raw_text: str, monkeypatch, adapter):
    monkeypatch.setattr(jobs_api, "LLMAdapter", lambda: adapter)
    mock_db = _mock_db(raw_text)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        return client.post(
            "/api/jobs/1/analyze-bias",
            json={"custom_text": raw_text},
            headers=_auth_headers(),
        )
    finally:
        app.dependency_overrides.clear()


def test_endpoint_reports_hybrid_and_counts_llm_finding(monkeypatch):
    response = _post_bias(IMPLICIT_AD_TEXT, monkeypatch, _FakeAdapter({"findings": [LLM_FINDING]}))

    assert response.status_code == 200
    data = response.json()
    assert data["analyzer"] == "HYBRID"
    assert data["total_bias_flags"] == 1
    assert data["bias_findings"][0]["detected_by"] == "LLM"
    # Single HIGH finding: 100 - 15, through the shared scorer.
    assert data["inclusivity_score"] == inclusivity_from_findings(data["bias_findings"])[0]


def test_endpoint_degrades_to_rules_only_without_gateway(monkeypatch):
    response = _post_bias(IMPLICIT_AD_TEXT, monkeypatch, _FakeAdapter(raises=RuntimeError("down")))

    assert response.status_code == 200
    data = response.json()
    assert data["analyzer"] == "RULES_ONLY"
    assert data["inclusivity_score"] == 100


def test_score_never_diverges_from_shared_scorer(monkeypatch):
    """Public portal and audit endpoint read the same function; a second formula is a bug."""
    biased = "Dicari ninja rockstar pria/wanita, usia maksimal 25 tahun, lulusan PTN ternama."
    response = _post_bias(biased, monkeypatch, _FakeAdapter({"findings": []}))

    data = response.json()
    expected, rating = inclusivity_from_findings(data["bias_findings"])
    assert data["inclusivity_score"] == expected
    assert data["inclusivity_rating"] == rating