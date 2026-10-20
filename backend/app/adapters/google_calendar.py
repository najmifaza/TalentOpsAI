"""
Google Calendar OAuth2 two-way sync adapter (PRD Bab 6.3, `[TARGET]` tier).

Design constraints:
  - Credentials are never stored in plaintext. Access/refresh tokens are sealed
    with the Master KEK (AES-256-GCM) and persisted in the `oauth_tokens` table,
    which already exists in the 12-table schema.
  - Client-generated deterministic event IDs give idempotency: a retried
    `events.insert` returns 409 Conflict instead of creating a duplicate event.
  - When `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are unset the adapter reports
    `configured=False` and callers stay on the mock adapter. No outbound call is
    ever attempted with empty credentials.
  - Refresh tokens rotate: a 401 from the Calendar API triggers exactly one
    refresh + retry, then surfaces the failure rather than looping.
"""
from __future__ import annotations

import base64
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_with_kek, encrypt_with_kek

logger = logging.getLogger(__name__)

PROVIDER = "google_calendar"
# Refresh a token this many seconds before it actually expires.
EXPIRY_SKEW_SECONDS = 120


class GoogleCalendarOAuthError(Exception):
    """Raised when the OAuth exchange or token refresh fails."""


class GoogleCalendarAdapter:
    """Live Google Calendar integration behind an explicit configuration gate."""

    TAG = "[GOOGLE CALENDAR LIVE]"

    # -- configuration ------------------------------------------------------

    @property
    def configured(self) -> bool:
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    def status(self) -> Dict[str, Any]:
        return {
            "configured": self.configured,
            "calendar_id": settings.GOOGLE_CALENDAR_ID if self.configured else None,
            "scopes": list(settings.GOOGLE_CALENDAR_SCOPES) if self.configured else [],
            "redirect_uri": settings.GOOGLE_REDIRECT_URI if self.configured else None,
            "tag": self.TAG if self.configured else "[MOCK / SANDBOX]",
        }

    def _client(self) -> httpx.AsyncClient:
        # trust_env=False: the VPS sets a global socks5 proxy in /etc/environment
        # which would otherwise intercept Google API calls.
        return httpx.AsyncClient(timeout=settings.GOOGLE_HTTP_TIMEOUT, trust_env=False)

    # -- event identity -----------------------------------------------------

    @staticmethod
    def generate_event_id(slot_id: int, candidate_id: int) -> str:
        """
        Deterministic base32hex-clean event ID, PRD Bab 6.3 item 1.

        Google requires lowercase base32hex, no padding, 5-1024 chars. The
        `talentops_` prefix keeps IDs namespaced inside a shared calendar.
        """
        raw = f"talentops_{slot_id}_{candidate_id}".encode("utf-8")
        b32 = base64.b32encode(raw).decode("utf-8").lower().rstrip("=")
        return b32

    # -- OAuth2 consent flow ------------------------------------------------

    def build_authorization_url(self, state: Optional[str] = None) -> Tuple[str, str]:
        """
        Returns (authorization_url, state). `state` is a CSRF nonce the caller must
        persist and compare on callback.
        """
        if not self.configured:
            raise GoogleCalendarOAuthError("GOOGLE_CALENDAR_NOT_CONFIGURED")

        csrf_state = state or secrets.token_urlsafe(32)
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(settings.GOOGLE_CALENDAR_SCOPES),
            "access_type": "offline",       # required to receive a refresh_token
            "include_granted_scopes": "true",
            "prompt": "consent",            # force refresh_token on re-consent
            "state": csrf_state,
        }
        return f"{settings.GOOGLE_OAUTH_AUTH_URL}?{urlencode(params)}", csrf_state

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchanges an authorization code for access + refresh tokens."""
        if not self.configured:
            raise GoogleCalendarOAuthError("GOOGLE_CALENDAR_NOT_CONFIGURED")

        payload = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
        async with self._client() as client:
            res = await client.post(settings.GOOGLE_OAUTH_TOKEN_URL, data=payload)

        if res.status_code != 200:
            raise GoogleCalendarOAuthError(
                f"TOKEN_EXCHANGE_FAILED: HTTP {res.status_code} {res.text[:300]}"
            )

        data = res.json()
        if not data.get("access_token"):
            raise GoogleCalendarOAuthError("TOKEN_EXCHANGE_RETURNED_NO_ACCESS_TOKEN")

        expires_in = int(data.get("expires_in", 3600))
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", ""),
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
            "scope": data.get("scope", ""),
            "token_type": data.get("token_type", "Bearer"),
        }

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Exchanges a refresh token for a fresh access token."""
        if not self.configured:
            raise GoogleCalendarOAuthError("GOOGLE_CALENDAR_NOT_CONFIGURED")

        payload = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        async with self._client() as client:
            res = await client.post(settings.GOOGLE_OAUTH_TOKEN_URL, data=payload)

        if res.status_code != 200:
            raise GoogleCalendarOAuthError(
                f"TOKEN_REFRESH_FAILED: HTTP {res.status_code} {res.text[:300]}"
            )

        data = res.json()
        if not data.get("access_token"):
            raise GoogleCalendarOAuthError("TOKEN_REFRESH_RETURNED_NO_ACCESS_TOKEN")

        expires_in = int(data.get("expires_in", 3600))
        return {
            "access_token": data["access_token"],
            # Google may omit refresh_token on refresh; keep the existing one.
            "refresh_token": data.get("refresh_token", refresh_token),
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
        }

    # -- credential persistence --------------------------------------------

    async def store_tokens(self, db: AsyncSession, user_id: int, tokens: Dict[str, Any]) -> None:
        """
        Upserts sealed tokens into `oauth_tokens`.

        Tokens are encrypted with the Master KEK before they touch the database;
        the plaintext never appears in a query parameter or log line.
        """
        enc_access = encrypt_with_kek(tokens["access_token"])
        enc_refresh = encrypt_with_kek(tokens.get("refresh_token") or "")

        await db.execute(
            text("""
                INSERT INTO oauth_tokens
                    (user_id, provider, encrypted_access_token, encrypted_refresh_token, token_expiry)
                VALUES
                    (:user_id, :provider, :access, :refresh, :expiry)
                ON DUPLICATE KEY UPDATE
                    encrypted_access_token = VALUES(encrypted_access_token),
                    encrypted_refresh_token = VALUES(encrypted_refresh_token),
                    token_expiry = VALUES(token_expiry)
            """),
            {
                "user_id": user_id,
                "provider": PROVIDER,
                "access": enc_access,
                "refresh": enc_refresh,
                "expiry": tokens["expires_at"].replace(tzinfo=None),
            },
        )
        await db.commit()

    async def load_tokens(self, db: AsyncSession, user_id: int) -> Optional[Dict[str, Any]]:
        """Loads and decrypts stored tokens for a user, or None when absent."""
        res = await db.execute(
            text("""
                SELECT encrypted_access_token, encrypted_refresh_token, token_expiry
                FROM oauth_tokens
                WHERE user_id = :user_id AND provider = :provider
            """),
            {"user_id": user_id, "provider": PROVIDER},
        )
        row = res.mappings().first()
        if not row:
            return None

        expiry = row["token_expiry"]
        if expiry is not None and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

        return {
            "access_token": decrypt_with_kek(row["encrypted_access_token"]),
            "refresh_token": decrypt_with_kek(row["encrypted_refresh_token"]),
            "expires_at": expiry,
        }

    async def get_valid_access_token(self, db: AsyncSession, user_id: int) -> str:
        """
        Returns a usable access token, refreshing it when expired or close to it.
        Raises GoogleCalendarOAuthError when the user has not connected a calendar.
        """
        stored = await self.load_tokens(db, user_id)
        if not stored or not stored.get("access_token"):
            raise GoogleCalendarOAuthError("NO_CALENDAR_CONNECTION_FOR_USER")

        expires_at = stored.get("expires_at")
        needs_refresh = (
            expires_at is None
            or expires_at <= datetime.now(timezone.utc) + timedelta(seconds=EXPIRY_SKEW_SECONDS)
        )
        if not needs_refresh:
            return stored["access_token"]

        if not stored.get("refresh_token"):
            raise GoogleCalendarOAuthError("ACCESS_TOKEN_EXPIRED_NO_REFRESH_TOKEN")

        refreshed = await self.refresh_access_token(stored["refresh_token"])
        await self.store_tokens(db, user_id, refreshed)
        return refreshed["access_token"]

    # -- Calendar API -------------------------------------------------------

    def _event_body(
        self,
        slot_id: int,
        candidate_id: int,
        start_time: datetime,
        end_time: datetime,
        summary: str,
        description: str = "",
    ) -> Dict[str, Any]:
        return {
            "id": self.generate_event_id(slot_id, candidate_id),
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_time.isoformat(), "timeZone": "Asia/Jakarta"},
            "end": {"dateTime": end_time.isoformat(), "timeZone": "Asia/Jakarta"},
            "extendedProperties": {
                "private": {
                    "talentops_slot_id": str(slot_id),
                    "talentops_candidate_id": str(candidate_id),
                }
            },
        }

    async def _authorized_request(
        self,
        db: AsyncSession,
        user_id: int,
        method: str,
        path: str,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        """
        Issues one authorized Calendar API call, refreshing on 401 exactly once.

        A single retry is deliberate: a second 401 means the refresh token itself
        is dead and looping would just burn quota.
        """
        token = await self.get_valid_access_token(db, user_id)
        url = f"{settings.GOOGLE_CALENDAR_API_BASE}{path}"

        async with self._client() as client:
            res = await client.request(
                method, url, json=json_body,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            )
            if res.status_code == 401:
                stored = await self.load_tokens(db, user_id)
                if not stored or not stored.get("refresh_token"):
                    return res
                refreshed = await self.refresh_access_token(stored["refresh_token"])
                await self.store_tokens(db, user_id, refreshed)
                res = await client.request(
                    method, url, json=json_body,
                    headers={
                        "Authorization": f"Bearer {refreshed['access_token']}",
                        "Accept": "application/json",
                    },
                )
        return res

    async def create_event(
        self,
        db: AsyncSession,
        user_id: int,
        slot_id: int,
        candidate_id: int,
        start_time: datetime,
        end_time: datetime,
        summary: str,
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Inserts an event with a client-generated ID.

        409 means the event already exists (retry or double dispatch) — treated as
        success with `already_existed=True`, which is what makes the operation
        idempotent rather than duplicating the interview.
        """
        if not self.configured:
            return {"success": False, "reason": "GOOGLE_CALENDAR_NOT_CONFIGURED", "tag": self.TAG}

        event_id = self.generate_event_id(slot_id, candidate_id)
        body = self._event_body(slot_id, candidate_id, start_time, end_time, summary, description)
        path = f"/calendars/{settings.GOOGLE_CALENDAR_ID}/events"

        try:
            res = await self._authorized_request(db, user_id, "POST", path, body)
        except GoogleCalendarOAuthError as exc:
            return {"success": False, "reason": str(exc), "tag": self.TAG}
        except httpx.HTTPError as exc:
            return {"success": False, "reason": f"CALENDAR_NETWORK_ERROR: {exc}", "tag": self.TAG}

        if res.status_code in (200, 201):
            data = res.json()
            return {
                "success": True,
                "event_id": data.get("id", event_id),
                "html_link": data.get("htmlLink"),
                "status": data.get("status", "confirmed"),
                "already_existed": False,
                "tag": self.TAG,
            }
        if res.status_code == 409:
            return {
                "success": True,
                "event_id": event_id,
                "already_existed": True,
                "reason": "EVENT_ID_ALREADY_EXISTS_IDEMPOTENT",
                "tag": self.TAG,
            }
        return {
            "success": False,
            "reason": f"CALENDAR_API_ERROR: HTTP {res.status_code} {res.text[:300]}",
            "tag": self.TAG,
        }

    async def update_event_time(
        self,
        db: AsyncSession,
        user_id: int,
        slot_id: int,
        candidate_id: int,
        start_time: datetime,
        end_time: datetime,
    ) -> Dict[str, Any]:
        """Patches an existing event's time window (reschedule propagation)."""
        if not self.configured:
            return {"success": False, "reason": "GOOGLE_CALENDAR_NOT_CONFIGURED", "tag": self.TAG}

        event_id = self.generate_event_id(slot_id, candidate_id)
        body = {
            "start": {"dateTime": start_time.isoformat(), "timeZone": "Asia/Jakarta"},
            "end": {"dateTime": end_time.isoformat(), "timeZone": "Asia/Jakarta"},
        }
        path = f"/calendars/{settings.GOOGLE_CALENDAR_ID}/events/{event_id}"

        try:
            res = await self._authorized_request(db, user_id, "PATCH", path, body)
        except GoogleCalendarOAuthError as exc:
            return {"success": False, "reason": str(exc), "tag": self.TAG}
        except httpx.HTTPError as exc:
            return {"success": False, "reason": f"CALENDAR_NETWORK_ERROR: {exc}", "tag": self.TAG}

        if res.status_code == 200:
            return {"success": True, "event_id": event_id, "tag": self.TAG}
        if res.status_code == 404:
            return {"success": False, "reason": "EVENT_NOT_FOUND", "tag": self.TAG}
        return {
            "success": False,
            "reason": f"CALENDAR_API_ERROR: HTTP {res.status_code} {res.text[:300]}",
            "tag": self.TAG,
        }

    async def cancel_event(
        self, db: AsyncSession, user_id: int, slot_id: int, candidate_id: int
    ) -> Dict[str, Any]:
        """
        Deletes the calendar event (compensating action for a released slot).

        404/410 are treated as success: the desired end state is "no event".
        """
        if not self.configured:
            return {"success": False, "reason": "GOOGLE_CALENDAR_NOT_CONFIGURED", "tag": self.TAG}

        event_id = self.generate_event_id(slot_id, candidate_id)
        path = f"/calendars/{settings.GOOGLE_CALENDAR_ID}/events/{event_id}"

        try:
            res = await self._authorized_request(db, user_id, "DELETE", path)
        except GoogleCalendarOAuthError as exc:
            return {"success": False, "reason": str(exc), "tag": self.TAG}
        except httpx.HTTPError as exc:
            return {"success": False, "reason": f"CALENDAR_NETWORK_ERROR: {exc}", "tag": self.TAG}

        if res.status_code in (200, 204, 404, 410):
            return {
                "success": True,
                "event_id": event_id,
                "already_absent": res.status_code in (404, 410),
                "tag": self.TAG,
            }
        return {
            "success": False,
            "reason": f"CALENDAR_API_ERROR: HTTP {res.status_code} {res.text[:300]}",
            "tag": self.TAG,
        }

    async def list_upcoming_events(
        self, db: AsyncSession, user_id: int, max_results: int = 20
    ) -> Dict[str, Any]:
        """Reads upcoming events for two-way sync reconciliation."""
        if not self.configured:
            return {"success": False, "reason": "GOOGLE_CALENDAR_NOT_CONFIGURED", "tag": self.TAG}

        now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        path = (
            f"/calendars/{settings.GOOGLE_CALENDAR_ID}/events"
            f"?timeMin={now_iso}&singleEvents=true&orderBy=startTime&maxResults={int(max_results)}"
        )
        try:
            res = await self._authorized_request(db, user_id, "GET", path)
        except GoogleCalendarOAuthError as exc:
            return {"success": False, "reason": str(exc), "tag": self.TAG}
        except httpx.HTTPError as exc:
            return {"success": False, "reason": f"CALENDAR_NETWORK_ERROR: {exc}", "tag": self.TAG}

        if res.status_code != 200:
            return {
                "success": False,
                "reason": f"CALENDAR_API_ERROR: HTTP {res.status_code} {res.text[:300]}",
                "tag": self.TAG,
            }

        items = res.json().get("items", [])
        events = []
        for item in items:
            events.append({
                "event_id": item.get("id"),
                "summary": item.get("summary"),
                "status": item.get("status"),
                "start": item.get("start", {}).get("dateTime") or item.get("start", {}).get("date"),
                "end": item.get("end", {}).get("dateTime") or item.get("end", {}).get("date"),
                "slot_id": item.get("extendedProperties", {}).get("private", {}).get("talentops_slot_id"),
                "candidate_id": item.get("extendedProperties", {}).get("private", {}).get("talentops_candidate_id"),
                "html_link": item.get("htmlLink"),
            })
        return {"success": True, "count": len(events), "data": events, "tag": self.TAG}


google_calendar_adapter = GoogleCalendarAdapter()
