import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.llm_adapter import (
    LLMAdapter,
    compute_file_hash,
    register_pre_cached_fixture,
)


async def run_checks():
    # 1. Deterministic hashing test
    h1 = compute_file_hash("resume sample content")
    h2 = compute_file_hash("resume sample content")
    assert h1 == h2, "Hash must be deterministic"
    assert len(h1) == 64, "SHA-256 hash must be 64 chars"

    # 2. Pre-cached store test
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

    # 3. Cache bypass test (use_cache=False)
    # Should attempt live completion instead of serving cache
    live_res = await adapter.complete(
        messages=[{"role": "user", "content": "Respond with single word: READY"}],
        file_hash=fake_hash,
        use_cache=False,
    )
    assert live_res["source"] == "LIVE"
    assert live_res["label"] == "[LIVE]"
    assert "READY" in live_res["content"].upper()

    print("ALL CHECKS PASSED: LLM Adapter verified.")


if __name__ == "__main__":
    asyncio.run(run_checks())
