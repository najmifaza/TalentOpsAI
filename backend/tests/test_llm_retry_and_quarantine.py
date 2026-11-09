"""
Ketahanan gateway LLM (kasus #TK-991E49 dan #TK-A662A3).

Dua cacat mahal yang diperbaiki di sini:

1. Batas waktu panggilan dipatok 12 detik, lebih pendek dari waktu yang dibutuhkan model
   untuk menjawab, sehingga setiap percobaan habis waktu dan pipeline jatuh ke heuristik
   meski gateway sehat (49-89 detik terbuang per kandidat).
2. Kegagalan HTTP tidak pernah masuk ke pesan error, sehingga log hanya berbunyi
   "Gateway exhausted all retries. Last error: None" tanpa petunjuk status sebenarnya.
Ditambah: penolakan `response_format` (400/404/422) oleh router kini dicoba ulang tanpa
field itu, karena beberapa router OpenAI-compatible menolaknya.
"""
import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core import llm_adapter
from app.core.config import settings
from app.core.llm_adapter import LLMAdapter, LLMAdapterError, circuit_breaker_state


class _Resp:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text or ""

    def json(self):
        return self._payload

    def raise_for_status(self):
        return None


class _Client:
    """Mencatat setiap payload agar bisa diperiksa apakah response_format ikut dikirim."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.payloads = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, headers=None, json=None):
        # Deep copy: `complete()` mutates the payload dict in place (dropping response_format),
        # so storing the reference would make every recorded request look like the last one.
        self.payloads.append(copy.deepcopy(json))
        return self._responses.pop(0) if self._responses else _Resp(500, text="no response queued")


def _patch(monkeypatch, client, timeout=30.0):
    monkeypatch.setattr(llm_adapter.httpx, "AsyncClient", lambda **kwargs: client)
    monkeypatch.setattr(settings, "LLM_TIMEOUT", timeout)


async def _complete(adapter, **kwargs):
    return await adapter.complete(messages=[{"role": "user", "content": "halo"}], **kwargs)


@pytest.mark.asyncio
async def test_timeout_honours_configured_value_not_a_12_second_cap(monkeypatch):
    """guard: the configured timeout must actually reach the HTTP client."""
    captured = {}

    def _factory(**kwargs):
        captured.update(kwargs)
        return _Client([_Resp(200, {"choices": [{"message": {"content": "{}"}}]})])

    monkeypatch.setattr(llm_adapter.httpx, "AsyncClient", _factory)
    monkeypatch.setattr(settings, "LLM_TIMEOUT", 30.0)

    await _complete(LLMAdapter(base_url="http://gw.local"), response_format={"type": "json_object"})
    assert captured.get("timeout", 0) >= 20.0, "12s cap regressed"


@pytest.mark.asyncio
async def test_response_format_rejection_is_retried_without_it(monkeypatch):
    client = _Client(
        [
            _Resp(400, text="response_format is not supported"),
            _Resp(200, {"choices": [{"message": {"content": '{"claims": []}'}}]}),
        ]
    )
    _patch(monkeypatch, client)

    result = await _complete(
        LLMAdapter(base_url="http://gw.local"), response_format={"type": "json_object"}
    )

    assert result["source"] == "LIVE"
    assert "response_format" in client.payloads[0]
    assert "response_format" not in client.payloads[1]


@pytest.mark.asyncio
async def test_repeated_auth_failures_open_the_circuit_breaker(monkeypatch):
    client = _Client([_Resp(401, text="Invalid API key")] * 8)
    _patch(monkeypatch, client)
    adapter = LLMAdapter(base_url="http://gw.local")

    for _ in range(3):
        with pytest.raises(LLMAdapterError):
            await _complete(adapter)

    assert circuit_breaker_state()["open"] is True

    calls_before = len(client.payloads)
    with pytest.raises(LLMAdapterError, match="GATEWAY_AUTH_QUARANTINE"):
        await _complete(adapter)
    assert len(client.payloads) == calls_before, "quarantined calls must not touch the network"


@pytest.mark.asyncio
async def test_http_status_reaches_the_error_message(monkeypatch):
    client = _Client([_Resp(500, text="upstream exploded")] * 4)
    _patch(monkeypatch, client)

    with pytest.raises(LLMAdapterError) as excinfo:
        await _complete(LLMAdapter(base_url="http://gw.local"))

    assert "None" not in str(excinfo.value)
    assert "HTTP_500" in str(excinfo.value)


@pytest.mark.asyncio
async def test_success_resets_the_failure_counter(monkeypatch):
    """One model only, so each call consumes exactly one queued response."""
    monkeypatch.setattr(settings, "LLM_FALLBACK_MODEL", settings.LLM_MODEL_NAME)
    client = _Client(
        [
            _Resp(401, text="nope"),
            _Resp(200, {"choices": [{"message": {"content": "{}"}}]}),
        ]
    )
    _patch(monkeypatch, client)
    adapter = LLMAdapter(base_url="http://gw.local")

    with pytest.raises(LLMAdapterError):
        await _complete(adapter)
    assert circuit_breaker_state()["auth_failures"] == 1

    result = await _complete(adapter)
    assert result["source"] == "LIVE"
    assert circuit_breaker_state()["auth_failures"] == 0
    assert circuit_breaker_state()["open"] is False
