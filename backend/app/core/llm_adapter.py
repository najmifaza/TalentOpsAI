import asyncio
import hashlib
import json
import logging
import os
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ponytail: In-memory dictionary cache for demo files. Upgrade to Redis Cluster for distributed enterprise.
PRE_CACHED_STORE: dict[str, dict[str, Any]] = {}

# Auto-load pre-cached fixtures for safe offline demo mode (PRD Bab 5.1)
_FIXTURES_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "golden_dataset", "pre_cached_fixtures.json")
)
if os.path.exists(_FIXTURES_PATH):
    try:
        with open(_FIXTURES_PATH, "r", encoding="utf-8") as _f:
            PRE_CACHED_STORE.update(json.load(_f))
    except Exception as _exc:
        logger.warning("Could not auto-load pre-cached fixtures from %s: %s", _FIXTURES_PATH, _exc)


def compute_file_hash(content: str | bytes) -> str:
    """SHA-256 hash for deterministic file cache identification."""
    data = content.encode("utf-8") if isinstance(content, str) else content
    return hashlib.sha256(data).hexdigest()


def register_pre_cached_fixture(file_hash: str, parsed_json: dict[str, Any]) -> None:
    """Seed cache for safe offline demo mode."""
    PRE_CACHED_STORE[file_hash] = parsed_json


class LLMAdapterError(Exception):
    pass


class LLMAdapter:
    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        self.base_url = (base_url or settings.LLM_ROUTER_BASE_URL).rstrip("/")
        self.api_key = (
            api_key
            or settings.LLM_API_KEY
            or (settings.LLM_ROUTER_API_KEY if settings.LLM_ROUTER_API_KEY != "dummy-key" else "")
            or os.getenv("CUSTOM_API_KEY", "")
        )
        self.headers: dict[str, str] = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"

    async def complete(
        self,
        messages: list[dict[str, str]],
        file_hash: str | None = None,
        use_cache: bool = True,
        temperature: float | None = None,
        model: str | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send completion request to 9router with retry, model fallback, and cache fallback."""
        # 1. Deterministic cache check
        if use_cache and file_hash and file_hash in PRE_CACHED_STORE:
            logger.info("Cache hit for file_hash: %s", file_hash)
            return {
                "source": "PRE_CACHED",
                "label": "[PRE-CACHED]",
                "model": "cache",
                "content": json.dumps(PRE_CACHED_STORE[file_hash]),
                "parsed": PRE_CACHED_STORE[file_hash],
            }

        target_model = model or settings.LLM_MODEL_NAME
        temp = settings.LLM_TEMPERATURE if temperature is None else temperature

        payload: dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "temperature": temp,
            "stream": False,
        }
        if response_format:
            payload["response_format"] = response_format

        # 2. Call gateway with exponential backoff and model fallback
        models_to_try = [target_model]
        if settings.LLM_FALLBACK_MODEL and settings.LLM_FALLBACK_MODEL != target_model:
            models_to_try.append(settings.LLM_FALLBACK_MODEL)

        last_err: Exception | None = None

        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
            for current_model in models_to_try:
                payload["model"] = current_model
                for attempt in range(1, settings.LLM_MAX_RETRIES + 1):
                    try:
                        resp = await client.post(
                            f"{self.base_url}/chat/completions",
                            headers=self.headers,
                            json=payload,
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            content = data["choices"][0]["message"]["content"]
                            return {
                                "source": "LIVE",
                                "label": "[LIVE]",
                                "model": current_model,
                                "content": content,
                                "raw": data,
                            }
                        logger.warning(
                            "Attempt %s (%s) returned status %s: %s",
                            attempt,
                            current_model,
                            resp.status_code,
                            resp.text[:200],
                        )
                    except (httpx.RequestError, httpx.TimeoutException) as exc:
                        last_err = exc
                        logger.warning("Attempt %s (%s) failed: %s", attempt, current_model, exc)

                    if attempt < settings.LLM_MAX_RETRIES:
                        await asyncio.sleep(0.5 * (2 ** (attempt - 1)))

        # 3. Gateway failed: check pre-cached fallback
        if file_hash and file_hash in PRE_CACHED_STORE:
            logger.warning("Fallback to pre-cached store after gateway failure for %s", file_hash)
            return {
                "source": "PRE_CACHED_FALLBACK",
                "label": "[PRE-CACHED]",
                "model": "cache_fallback",
                "content": json.dumps(PRE_CACHED_STORE[file_hash]),
                "parsed": PRE_CACHED_STORE[file_hash],
            }

        raise LLMAdapterError(f"Gateway exhausted all retries. Last error: {last_err}")
