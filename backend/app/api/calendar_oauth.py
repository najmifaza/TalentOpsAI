"""
Google Calendar OAuth2 connection endpoints (PRD Bab 6.3 `[TARGET]`).

Flow:
  1. `GET /api/calendar/oauth/authorize`  -> returns the Google consent URL
  2. user consents in the browser
  3. `GET /api/calendar/oauth/callback`   -> exchanges the code, seals tokens in
     `oauth_tokens`, then redirects to the frontend WITHOUT tokens in the URL
  4. `GET /api/calendar/status`           -> whether the caller has a live link
  5. `POST /api/calendar/disconnect`      -> revokes the local link

CSRF: the `state` nonce is stored in Redis when available (shared across workers)
and falls back to an in-process dict otherwise. It is single-use and TTL-bounded.
"""
from __future__ import annotations

import logging
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.google_calendar import (
    PROVIDER,
    GoogleCalendarOAuthError,
    google_calendar_adapter,
)
from app.core.auth import require_roles
from app.core.config import settings
from app.core.database import get_db
from app.core.state import key, redis_state

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["Calendar & Scheduling"])

STATE_TTL_SECONDS = 600

# In-process fallback for OAuth state when Redis is unavailable (single worker).
_local_states: Dict[str, float] = {}


async def _store_state(state: str, user_id: int) -> None:
    client = await redis_state.client()
    if client is not None:
        await client.set(key("oauth", "state", state), str(user_id), ex=STATE_TTL_SECONDS)
        return
    now = time.time()
    for stale in [s for s, exp in _local_states.items() if exp < now]:
        _local_states.pop(stale, None)
    _local_states[state] = now + STATE_TTL_SECONDS


async def _consume_state(state: str) -> Optional[int]:
    """
    Validates and burns the CSRF state. Returns the originating user_id, or None.

    Single-use on purpose: a replayed callback must not mint a second token set.
    """
    client = await redis_state.client()
    if client is not None:
        redis_key = key("oauth", "state", state)
        try:
            raw = await client.getdel(redis_key)
        except Exception:
            raw = await client.get(redis_key)
            if raw is not None:
                await client.delete(redis_key)
        if raw is None:
            return None
        try:
            return int(raw)
        except Exception:
            return None

    exp = _local_states.pop(state, None)
    if exp is None or exp < time.time():
        return None
    # Local fallback cannot round-trip the user id; the caller re-derives it.
    return 0


@router.get("/status")
async def calendar_status(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """
    Reports whether Google Calendar is configured on the server and whether the
    calling user has an active (non-expired) connection.
    """
    user_id = int(current_user["id"])
    adapter_status = google_calendar_adapter.status()

    connected = False
    expires_at = None
    if adapter_status["configured"]:
        try:
            stored = await google_calendar_adapter.load_tokens(db, user_id)
            if stored and stored.get("access_token"):
                connected = True
                expires_at = stored["expires_at"].isoformat() if stored.get("expires_at") else None
        except Exception as exc:
            logger.warning("Failed to read stored calendar tokens for user %s: %s", user_id, exc)

    return {
        "status": "success",
        "user_id": user_id,
        **adapter_status,
        "connected": connected,
        "token_expires_at": expires_at,
    }


@router.get("/oauth/authorize")
async def calendar_oauth_authorize(
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """Returns the Google consent URL plus the CSRF state to expect on callback."""
    if not google_calendar_adapter.configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_CALENDAR_NOT_CONFIGURED: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )

    user_id = int(current_user["id"])
    auth_url, state_nonce = google_calendar_adapter.build_authorization_url()
    await _store_state(state_nonce, user_id)

    return {
        "status": "success",
        "authorization_url": auth_url,
        "state": state_nonce,
        "expires_in_seconds": STATE_TTL_SECONDS,
    }


@router.get("/oauth/callback")
async def calendar_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Handles Google's redirect.

    Intentionally unauthenticated: the browser arrives from Google without our
    Bearer header. Trust comes from the single-use `state` nonce, which ties the
    callback to the user who started the flow.
    """
    redirect_base = settings.OAUTH_SUCCESS_REDIRECT

    def _redirect(**params: str) -> RedirectResponse:
        sep = "&" if "?" in redirect_base else "?"
        return RedirectResponse(f"{redirect_base}{sep}{urlencode(params)}", status_code=302)

    if error:
        logger.info("Calendar OAuth denied by user: %s", error)
        return _redirect(calendar="denied", reason=error[:100])

    if not code or not state:
        return _redirect(calendar="error", reason="missing_code_or_state")

    user_id = await _consume_state(state)
    if user_id is None:
        logger.warning("Calendar OAuth callback rejected: invalid or expired state")
        return _redirect(calendar="error", reason="invalid_state")

    if not google_calendar_adapter.configured:
        return _redirect(calendar="error", reason="not_configured")

    try:
        tokens = await google_calendar_adapter.exchange_code_for_tokens(code)
    except GoogleCalendarOAuthError as exc:
        logger.warning("Calendar token exchange failed: %s", exc)
        return _redirect(calendar="error", reason="token_exchange_failed")
    except Exception as exc:
        logger.warning("Calendar token exchange crashed: %s", type(exc).__name__)
        return _redirect(calendar="error", reason="token_exchange_failed")

    # Local state fallback cannot carry the user id; refuse rather than guess.
    if user_id == 0:
        return _redirect(calendar="error", reason="state_user_unresolved")

    await google_calendar_adapter.store_tokens(db, user_id, tokens)
    logger.info("Google Calendar connected for user %s", user_id)
    return _redirect(calendar="connected")


@router.post("/disconnect")
async def calendar_disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """Removes the stored OAuth tokens for the calling user."""
    user_id = int(current_user["id"])
    res = await db.execute(
        text("DELETE FROM oauth_tokens WHERE user_id = :uid AND provider = :provider"),
        {"uid": user_id, "provider": PROVIDER},
    )
    await db.commit()
    return {
        "status": "success",
        "disconnected": True,
        "rows_deleted": res.rowcount,
        "user_id": user_id,
    }


@router.get("/events")
async def list_calendar_events(
    max_results: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "recruiter", "hiring_manager")),
):
    """Reads upcoming events for two-way sync reconciliation."""
    if not google_calendar_adapter.configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_CALENDAR_NOT_CONFIGURED",
        )
    result = await google_calendar_adapter.list_upcoming_events(
        db, int(current_user["id"]), max_results=max_results
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.get("reason", "CALENDAR_READ_FAILED"),
        )
    return result
