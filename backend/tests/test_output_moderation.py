"""
Item #8 — outbound moderation (docs/RENCANA_PENGEMBANGAN_AI.md §4).

Inbound guardrails (PII, hidden text, prompt injection) are covered elsewhere. These
tests pin the outbound side: what the system is allowed to emit.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core import moderation
from app.core.config import settings

LONG_NEUTRAL_TEXT = (
    "Kandidat menunjukkan penguasaan FastAPI dan PostgreSQL pada tiga proyek produksi. "
    "Evaluasi menyoroti kedalaman desain sistem, penanganan kegagalan, dan kejelasan "
    "komunikasi teknis dengan tim lintas fungsi selama siklus pengembangan berjalan. "
    "Rekomendasi lanjutan adalah sesi wawancara teknis dengan fokus studi kasus."
)


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


def test_patterns_allow_neutral_hiring_text():
    verdict = moderation.check_patterns("Kandidat menguasai FastAPI dan Docker.")
    assert verdict.allowed is True
    assert verdict.mode == "PATTERNS_ONLY"


def test_patterns_block_sara_construction():
    verdict = moderation.check_patterns("Golongan itu memang rendah dan tidak pantas direkrut.")
    assert verdict.allowed is False
    assert verdict.reason == "BLOCKED_SARA"


def test_patterns_block_harassment_and_violence():
    assert moderation.check_patterns("Dasar bodoh, jawabanmu tidak jelas.").allowed is False
    assert moderation.check_patterns("Saya akan membunuh proses rekrutmen ini.").allowed is False
    assert moderation.check_patterns("Berisi konten pornografi.").allowed is False


def test_verbatim_cv_quote_is_not_moderated():
    """context_narrative is a CV quote; filtering it would break the substring guard."""
    quote = "Menurunkan latensi API 40% dan memangkas biaya server Rp120 juta per tahun."
    assert moderation.check_patterns(quote).allowed is True


def test_scrub_narration_returns_fallback_on_block():
    scrubbed, reason = moderation.scrub_narration("Klaim itu dasar bodoh dan tidak relevan.")
    assert scrubbed == moderation.NARRATION_FALLBACK
    assert reason == "BLOCKED_HARASSMENT"


def test_scrub_narration_passes_template_text_through():
    text = "Memeriksa integritas naskah resume (1200 karakter). Berkas bersih."
    scrubbed, reason = moderation.scrub_narration(text)
    assert scrubbed == text
    assert reason is None


@pytest.mark.asyncio
async def test_llm_layer_blocks_when_classifier_says_unsafe(monkeypatch):
    monkeypatch.setattr(settings, "MODERATION_LLM_ENABLED", True)
    monkeypatch.setattr(
        moderation, "LLMAdapter", lambda: _FakeAdapter({"safe": False, "category": "SARA"})
    )

    verdict = await moderation.check(LONG_NEUTRAL_TEXT, context="test")
    assert verdict.allowed is False
    assert verdict.reason == "BLOCKED_SARA"
    assert verdict.mode == "HYBRID"


@pytest.mark.asyncio
async def test_llm_layer_passes_clean_text(monkeypatch):
    monkeypatch.setattr(settings, "MODERATION_LLM_ENABLED", True)
    monkeypatch.setattr(
        moderation, "LLMAdapter", lambda: _FakeAdapter({"safe": True, "category": None})
    )

    verdict = await moderation.check(LONG_NEUTRAL_TEXT, context="test")
    assert verdict.allowed is True
    assert verdict.mode == "HYBRID"


@pytest.mark.asyncio
async def test_gateway_failure_degrades_to_patterns_only(monkeypatch):
    """A broken moderator must not take down the pipeline."""
    monkeypatch.setattr(settings, "MODERATION_LLM_ENABLED", True)
    monkeypatch.setattr(moderation, "LLMAdapter", lambda: _FakeAdapter(raises=RuntimeError("gateway down")))

    verdict = await moderation.check(LONG_NEUTRAL_TEXT, context="test")
    assert verdict.allowed is True
    assert verdict.mode == "PATTERNS_ONLY"


@pytest.mark.asyncio
async def test_short_text_skips_classifier(monkeypatch):
    monkeypatch.setattr(settings, "MODERATION_LLM_ENABLED", True)
    adapter = _FakeAdapter({"safe": False, "category": "SARA"})
    monkeypatch.setattr(moderation, "LLMAdapter", lambda: adapter)

    verdict = await moderation.check("Rapi dan jelas.", context="test")
    assert verdict.allowed is True
    assert adapter.calls == 0

@pytest.mark.asyncio
async def test_broadcaster_scrubs_blocked_narration():
    """Single choke point: every published ai_thought passes the pattern layer."""
    from app.core.broadcaster import sse_broadcaster

    await sse_broadcaster.publish(
        987654,
        "llm_extraction",
        "completed",
        {"ai_thought": "Klaim kandidat ini dasar bodoh dan tidak relevan.", "backend_action": "ok"},
    )

    event = sse_broadcaster._history[987654][-1]
    assert event["details"]["moderation_blocked"] is True
    assert event["details"]["moderation_reason"] == "BLOCKED_HARASSMENT"
    assert event["details"]["ai_thought"] == moderation.NARRATION_FALLBACK
