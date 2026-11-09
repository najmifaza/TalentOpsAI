import asyncio
import hashlib
import time
import json
import logging
import os
from typing import Any

import httpx

from app.core.config import settings
from app.core.prompt import clean_llm_json_response

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


# --- Circuit breaker for credential failures -------------------------------------------
# A wrong or expired gateway key used to cost ~50 s per candidate: two models x two attempts
# x the full timeout, every single run. Three consecutive rejections now quarantine the
# gateway briefly so triage falls back to the heuristic engine immediately instead of
# waiting out the retry budget on every file.
AUTH_QUARANTINE_THRESHOLD = 3
AUTH_QUARANTINE_SECONDS = 180.0
_auth_failures = 0
_quarantined_until = 0.0


def reset_llm_circuit_breaker() -> None:
    """Test hook and manual reset after fixing credentials."""
    global _auth_failures, _quarantined_until
    _auth_failures = 0
    _quarantined_until = 0.0


def circuit_breaker_state() -> dict:
    return {
        "auth_failures": _auth_failures,
        "quarantined_until": _quarantined_until,
        "open": time.monotonic() < _quarantined_until,
    }


def _note_auth_failure() -> None:
    global _auth_failures, _quarantined_until
    _auth_failures += 1
    if _auth_failures >= AUTH_QUARANTINE_THRESHOLD:
        _quarantined_until = time.monotonic() + AUTH_QUARANTINE_SECONDS
        logger.error(
            "LLM gateway rejected %s consecutive calls; pausing live calls for %ss",
            _auth_failures,
            AUTH_QUARANTINE_SECONDS,
        )


class LLMAdapter:
    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        self.base_url = (base_url or settings.LLM_ROUTER_BASE_URL).rstrip("/")
        self.api_key = (
            api_key
            or settings.LLM_API_KEY
            or settings.LLM_ROUTER_API_KEY
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

        global _auth_failures, _quarantined_until

        if _quarantined_until and time.monotonic() < _quarantined_until:
            raise LLMAdapterError(
                "GATEWAY_AUTH_QUARANTINE: gateway rejected credentials repeatedly; "
                "live calls paused, heuristic engine will be used."
            )

        last_err: Exception | None = None
        # The old 12 s ceiling was shorter than a thinking model's first token, so every
        # attempt timed out and the pipeline fell back to the heuristic engine even though
        # the gateway was healthy. Honour LLM_TIMEOUT instead, bounded to something sane.
        call_timeout = max(5.0, min(settings.LLM_TIMEOUT, 60.0))
        max_retries = min(settings.LLM_MAX_RETRIES, 2)
        # Routers that do not implement OpenAI strict-JSON reject the whole request with 400.
        # Retrying once without `response_format` keeps structured extraction alive.
        drop_response_format = False

        # trust_env=False prevents local loopback calls from being intercepted by global SOCKS/HTTP proxies
        async with httpx.AsyncClient(timeout=call_timeout, trust_env=False) as client:
            for current_model in models_to_try:
                payload["model"] = current_model
                drop_response_format = False
                for attempt in range(1, max_retries + 1):
                    if drop_response_format and "response_format" in payload:
                        payload.pop("response_format", None)
                    try:
                        resp = await client.post(
                            f"{self.base_url}/chat/completions",
                            headers=self.headers,
                            json=payload,
                        )
                        if resp.status_code == 200:
                            _auth_failures = 0
                            _quarantined_until = 0.0
                            data = resp.json()
                            content = data["choices"][0]["message"]["content"]
                            return {
                                "source": "LIVE",
                                "label": "[LIVE]",
                                "model": current_model,
                                "content": content,
                                "raw": data,
                            }
                        if resp.status_code in (401, 403):
                            logger.warning(
                                "LLM Gateway auth error %s on %s: %s",
                                resp.status_code,
                                current_model,
                                resp.text[:200],
                            )
                            _note_auth_failure()
                            # Bad credentials apply to every model; stop burning time here.
                            last_err = LLMAdapterError(
                                f"GATEWAY_AUTH_{resp.status_code}: {resp.text[:200]}"
                            )
                            break
                        if resp.status_code in (400, 404, 422) and "response_format" in payload:
                            logger.warning(
                                "LLM Gateway rejected response_format (%s); retrying without it",
                                resp.status_code,
                            )
                            drop_response_format = True
                            continue
                        if resp.status_code == 404:
                            logger.warning(
                                "LLM Gateway model not found %s: %s", current_model, resp.text[:200]
                            )
                            last_err = LLMAdapterError(
                                f"MODEL_NOT_FOUND_{resp.status_code}: {current_model}"
                            )
                            break
                        last_err = LLMAdapterError(
                            f"HTTP_{resp.status_code}: {resp.text[:200]}"
                        )
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

                    if attempt < max_retries:
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
