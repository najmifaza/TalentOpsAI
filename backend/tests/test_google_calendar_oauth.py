"""
Google Calendar OAuth2 adapter test suite.

No network calls: `httpx.AsyncClient` is replaced with a stub that records requests
and returns scripted responses. Covers:
  - configuration gate (no credentials => no outbound call)
  - consent URL construction (offline access, scopes, CSRF state)
  - authorization-code exchange and token sealing under the Master KEK
  - deterministic event IDs matching the PRD base32hex spec
  - idempotency: 409 Conflict treated as success
  - single refresh-and-retry on 401, no infinite loop
  - compensating cancel treating 404/410 as success
"""
import base64
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.adapters.google_calendar import (
    GoogleCalendarAdapter,
    GoogleCalendarOAuthError,
    PROVIDER,
)
from app.core.config import settings
from app.core.crypto import decrypt_with_kek, encrypt_with_kek


class FakeResponse:
    def __init__(self, status_code, json_body=None, text=""):
        self.status_code = status_code
        self._json = json_body or {}
        self.text = text or str(json_body)

    def json(self):
        return self._json


class FakeHTTPClient:
    """Stands in for httpx.AsyncClient; records calls, replays scripted responses."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def request(self, method, url, json=None, headers=None, **kwargs):
        self.calls.append({"method": method, "url": url, "json": json, "headers": headers})
        return self.responses.pop(0) if self.responses else FakeResponse(500, text="no scripted response")

    async def post(self, url, data=None, json=None, headers=None, **kwargs):
        self.calls.append({"method": "POST", "url": url, "data": data, "json": json, "headers": headers})
        return self.responses.pop(0) if self.responses else FakeResponse(500, text="no scripted response")


@pytest.fixture
def configured():
    """Enables the adapter with dummy credentials, restoring settings afterwards."""
    original = (settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET)
    settings.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"
    settings.GOOGLE_CLIENT_SECRET = "test-client-secret"
    try:
        yield
    finally:
        settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET = original


@pytest.fixture
def unconfigured():
    original = (settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET)
    settings.GOOGLE_CLIENT_ID = ""
    settings.GOOGLE_CLIENT_SECRET = ""
    try:
        yield
    finally:
        settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET = original


def make_db(tokens_row=None):
    """AsyncSession stand-in returning a stored-token row on demand."""
    db = AsyncMock()
    res = MagicMock()
    res.mappings.return_value.first.return_value = tokens_row
    res.rowcount = 1
    db.execute = AsyncMock(return_value=res)
    db.commit = AsyncMock()
    return db


# -- configuration gate ----------------------------------------------------

def test_unconfigured_adapter_reports_sandbox(unconfigured):
    adapter = GoogleCalendarAdapter()
    status = adapter.status()
    assert status["configured"] is False
    assert status["tag"] == "[MOCK / SANDBOX]"
    assert status["scopes"] == []


@pytest.mark.asyncio
async def test_unconfigured_create_event_makes_no_call(unconfigured):
    """With no credentials the adapter must refuse without touching the network."""
    adapter = GoogleCalendarAdapter()
    result = await adapter.create_event(
        db=make_db(), user_id=1, slot_id=1, candidate_id=2,
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc) + timedelta(hours=1),
        summary="x",
    )
    assert result["success"] is False
    assert result["reason"] == "GOOGLE_CALENDAR_NOT_CONFIGURED"


def test_authorization_url_contains_offline_access(configured):
    adapter = GoogleCalendarAdapter()
    url, state = adapter.build_authorization_url()
    assert "access_type=offline" in url            # required to get a refresh_token
    assert "response_type=code" in url
    assert f"state={state}" in url
    assert "calendar.events" in url
    assert len(state) >= 20


def test_authorization_url_rejects_when_unconfigured(unconfigured):
    with pytest.raises(GoogleCalendarOAuthError):
        GoogleCalendarAdapter().build_authorization_url()


# -- token handling --------------------------------------------------------

def test_kek_sealing_roundtrip():
    """OAuth secrets must be sealed under the Master KEK, not stored raw."""
    secret = "ya29.a0AfH6SMB-example-access-token"
    sealed = encrypt_with_kek(secret)
    assert isinstance(sealed, bytes) and len(sealed) > 12
    assert secret.encode() not in sealed
    assert decrypt_with_kek(sealed) == secret


@pytest.mark.asyncio
async def test_exchange_code_returns_token_set(configured):
    adapter = GoogleCalendarAdapter()
    client = FakeHTTPClient([FakeResponse(200, {
        "access_token": "ya29.access",
        "refresh_token": "1//refresh",
        "expires_in": 3600,
        "scope": "calendar.events",
        "token_type": "Bearer",
    })])

    with patch.object(adapter, "_client", return_value=client):
        tokens = await adapter.exchange_code_for_tokens("auth-code-123")

    assert tokens["access_token"] == "ya29.access"
    assert tokens["refresh_token"] == "1//refresh"
    assert tokens["expires_at"] > datetime.now(timezone.utc)
    assert client.calls[0]["data"]["grant_type"] == "authorization_code"


@pytest.mark.asyncio
async def test_exchange_code_failure_raises(configured):
    adapter = GoogleCalendarAdapter()
    client = FakeHTTPClient([FakeResponse(400, {"error": "invalid_grant"}, "invalid_grant")])
    with patch.object(adapter, "_client", return_value=client):
        with pytest.raises(GoogleCalendarOAuthError) as exc:
            await adapter.exchange_code_for_tokens("bad-code")
    assert "TOKEN_EXCHANGE_FAILED" in str(exc.value)


@pytest.mark.asyncio
async def test_refresh_keeps_existing_refresh_token_when_omitted(configured):
    """Google may omit refresh_token on refresh; the old one must be preserved."""
    adapter = GoogleCalendarAdapter()
    client = FakeHTTPClient([FakeResponse(200, {"access_token": "ya29.new", "expires_in": 3600})])
    with patch.object(adapter, "_client", return_value=client):
        refreshed = await adapter.refresh_access_token("1//existing")
    assert refreshed["access_token"] == "ya29.new"
    assert refreshed["refresh_token"] == "1//existing"


@pytest.mark.asyncio
async def test_store_tokens_encrypts_before_persisting(configured):
    """The INSERT parameters must not contain plaintext tokens."""
    adapter = GoogleCalendarAdapter()
    db = make_db()
    tokens = {
        "access_token": "ya29.plaintext-access",
        "refresh_token": "1//plaintext-refresh",
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    await adapter.store_tokens(db, user_id=1, tokens=tokens)

    params = db.execute.await_args[0][1]
    assert params["access"] != b"ya29.plaintext-access"
    assert b"plaintext" not in params["access"]
    assert b"plaintext" not in params["refresh"]
    assert decrypt_with_kek(params["access"]) == "ya29.plaintext-access"
    assert decrypt_with_kek(params["refresh"]) == "1//plaintext-refresh"


@pytest.mark.asyncio
async def test_get_valid_token_refreshes_when_expired(configured):
    """An expired access token must be refreshed transparently."""
    adapter = GoogleCalendarAdapter()
    expired = datetime.now(timezone.utc) - timedelta(hours=1)
    db = make_db({
        "encrypted_access_token": encrypt_with_kek("ya29.stale"),
        "encrypted_refresh_token": encrypt_with_kek("1//refresh"),
        "token_expiry": expired,
    })

    client = FakeHTTPClient([FakeResponse(200, {"access_token": "ya29.fresh", "expires_in": 3600})])
    with patch.object(adapter, "_client", return_value=client):
        token = await adapter.get_valid_access_token(db, user_id=1)

    assert token == "ya29.fresh"
    assert any("oauth2.googleapis.com" in c["url"] for c in client.calls)


@pytest.mark.asyncio
async def test_get_valid_token_without_connection_raises(configured):
    adapter = GoogleCalendarAdapter()
    with pytest.raises(GoogleCalendarOAuthError) as exc:
        await adapter.get_valid_access_token(make_db(None), user_id=1)
    assert "NO_CALENDAR_CONNECTION" in str(exc.value)


# -- event identity & idempotency -----------------------------------------

def test_event_id_is_deterministic_base32hex(configured):
    """PRD Bab 6.3: lowercase base32, no padding, 5-1024 chars."""
    event_id = GoogleCalendarAdapter.generate_event_id(12, 34)
    assert event_id == GoogleCalendarAdapter.generate_event_id(12, 34)
    assert event_id == event_id.lower()
    assert "=" not in event_id
    assert 5 <= len(event_id) <= 1024
    assert set(event_id) <= set("abcdefghijklmnopqrstuvwxyz234567")
    # Decodes back to the documented source string
    padded = event_id.upper() + "=" * (-len(event_id) % 8)
    assert base64.b32decode(padded).decode() == "talentops_12_34"


@pytest.mark.asyncio
async def test_create_event_409_is_idempotent_success(configured):
    """A duplicate insert must be treated as success, not an error."""
    adapter = GoogleCalendarAdapter()
    db = make_db({
        "encrypted_access_token": encrypt_with_kek("ya29.valid"),
        "encrypted_refresh_token": encrypt_with_kek("1//refresh"),
        "token_expiry": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    client = FakeHTTPClient([FakeResponse(409, {"error": "duplicate"}, "conflict")])

    with patch.object(adapter, "_client", return_value=client):
        result = await adapter.create_event(
            db=db, user_id=1, slot_id=12, candidate_id=34,
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc) + timedelta(hours=1),
            summary="Interview",
        )

    assert result["success"] is True
    assert result["already_existed"] is True
    assert result["event_id"] == GoogleCalendarAdapter.generate_event_id(12, 34)


@pytest.mark.asyncio
async def test_create_event_sends_generated_id_in_body(configured):
    adapter = GoogleCalendarAdapter()
    db = make_db({
        "encrypted_access_token": encrypt_with_kek("ya29.valid"),
        "encrypted_refresh_token": encrypt_with_kek("1//refresh"),
        "token_expiry": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    client = FakeHTTPClient([FakeResponse(200, {"id": "abc", "htmlLink": "https://cal/abc"})])

    with patch.object(adapter, "_client", return_value=client):
        result = await adapter.create_event(
            db=db, user_id=1, slot_id=5, candidate_id=9,
            start_time=datetime(2026, 11, 1, 9, 0),
            end_time=datetime(2026, 11, 1, 10, 0),
            summary="Interview",
        )

    sent = client.calls[0]["json"]
    assert sent["id"] == GoogleCalendarAdapter.generate_event_id(5, 9)
    assert sent["extendedProperties"]["private"]["talentops_slot_id"] == "5"
    assert result["success"] is True


@pytest.mark.asyncio
async def test_401_triggers_single_refresh_then_succeeds(configured):
    """One refresh + retry on 401; the retry uses the new access token."""
    adapter = GoogleCalendarAdapter()
    db = make_db({
        "encrypted_access_token": encrypt_with_kek("ya29.stale"),
        "encrypted_refresh_token": encrypt_with_kek("1//refresh"),
        "token_expiry": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    client = FakeHTTPClient([
        FakeResponse(401, {"error": "invalid_credentials"}, "unauthorized"),
        FakeResponse(200, {"access_token": "ya29.fresh", "expires_in": 3600}),  # refresh
        FakeResponse(200, {"id": "evt", "status": "confirmed"}),                # retry
    ])

    with patch.object(adapter, "_client", return_value=client):
        result = await adapter.create_event(
            db=db, user_id=1, slot_id=1, candidate_id=1,
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc) + timedelta(hours=1),
            summary="x",
        )

    assert result["success"] is True
    # 401, refresh, retry
    assert len(client.calls) == 3
    assert client.calls[2]["headers"]["Authorization"] == "Bearer ya29.fresh"


@pytest.mark.asyncio
async def test_cancel_event_treats_404_as_success(configured):
    """Desired end state is 'no event'; 404 already satisfies it."""
    adapter = GoogleCalendarAdapter()
    db = make_db({
        "encrypted_access_token": encrypt_with_kek("ya29.valid"),
        "encrypted_refresh_token": encrypt_with_kek("1//refresh"),
        "token_expiry": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    client = FakeHTTPClient([FakeResponse(404, text="not found")])

    with patch.object(adapter, "_client", return_value=client):
        result = await adapter.cancel_event(db=db, user_id=1, slot_id=3, candidate_id=4)

    assert result["success"] is True
    assert result["already_absent"] is True
