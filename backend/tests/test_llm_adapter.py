import os
import sys
from unittest.mock import AsyncMock, patch
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.llm_adapter import (
    LLMAdapter,
    compute_file_hash,
    register_pre_cached_fixture,
)


def test_deterministic_hashing():
    h1 = compute_file_hash("resume sample content")
    h2 = compute_file_hash("resume sample content")
    assert h1 == h2, "Hash must be deterministic"
    assert len(h1) == 64, "SHA-256 hash must be 64 chars"


@pytest.mark.asyncio
async def test_pre_cached_store():
    fake_hash = "mock_hash_123456"
    fixture_data = {"candidate": "Budi Santoso", "skills": ["FastAPI", "Python"]}
    register_pre_cached_fixture(fake_hash, fixture_data)

    adapter = LLMAdapter()
    cached_res = await adapter.complete(
        messages=[{"role": "user", "content": "extract"}],
        file_hash=fake_hash,
        use_cache=True,
    )
    assert cached_res["source"] == "PRE_CACHED"
    assert cached_res["label"] == "[PRE-CACHED]"
    assert cached_res["parsed"]["candidate"] == "Budi Santoso"


@pytest.mark.asyncio
async def test_cache_bypass_mocked_gateway():
    fake_hash = "mock_hash_bypass_999"
    adapter = LLMAdapter()

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = lambda: {
        "choices": [{"message": {"content": "READY"}}]
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        live_res = await adapter.complete(
            messages=[{"role": "user", "content": "Respond with single word: READY"}],
            file_hash=fake_hash,
            use_cache=False,
        )
        assert live_res["source"] == "LIVE"
        assert live_res["label"] == "[LIVE]"
        assert "READY" in live_res["content"].upper()
