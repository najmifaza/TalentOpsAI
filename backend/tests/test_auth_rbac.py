"""
Authentication & RBAC test suite:
- JWT HS256 issuance/validation (stdlib hmac, no external dep)
- POST /api/auth/login credential flow
- GET /api/auth/me authenticated profile
- require_roles dependency rejecting unauthorized roles
- Guard enforcement on protected routers (candidates/jobs/slots/audit)
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    require_roles,
    verify_password,
)
from app.core.database import get_db

client = TestClient(app)


def test_password_hash_roundtrip():
    """PBKDF2-HMAC-SHA256 hash must verify the original password and reject others."""
    stored = hash_password("AdminSecret2026!")
    assert stored.startswith("pbkdf2:")
    assert verify_password("AdminSecret2026!", stored) is True
    assert verify_password("wrong_password", stored) is False
    # Distinct salts per hash
    assert hash_password("AdminSecret2026!") != stored


def test_jwt_roundtrip_and_expiry():
    """JWT must round-trip payload and reject tampered signature/expired token."""
    token = create_access_token({"sub": "1", "role": "recruiter", "username": "recruiter_talentops"})
    payload = decode_access_token(token)
    assert payload["sub"] == "1"
    assert payload["role"] == "recruiter"
    assert "exp" in payload

    # Tampered signature rejected
    parts = token.split(".")
    tampered = f"{parts[0]}.{parts[1]}.{parts[2][:-4]}AAAA"
    with pytest.raises(HTTPException) as exc:
        decode_access_token(tampered)
    assert exc.value.status_code == 401

    # Expired token rejected
    expired = create_access_token({"sub": "1"}, expires_seconds=-10)
    with pytest.raises(HTTPException) as exc_exp:
        decode_access_token(expired)
    assert exc_exp.value.status_code == 401
    assert "EXPIRED" in exc_exp.value.detail


def test_malformed_token_rejected():
    """Tokens without three segments must be rejected."""
    with pytest.raises(HTTPException) as exc:
        decode_access_token("not-a-jwt")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_require_roles_allows_and_denies():
    """RBAC dependency must pass whitelisted roles and 403 the rest."""
    checker = require_roles("admin", "recruiter")

    allowed = await checker({"id": 1, "role": "recruiter", "username": "u", "email": "e"})
    assert allowed["role"] == "recruiter"

    with pytest.raises(HTTPException) as exc:
        await checker({"id": 2, "role": "compliance_officer", "username": "u", "email": "e"})
    assert exc.value.status_code == 403
    assert "INSUFFICIENT_PERMISSIONS" in exc.value.detail


def test_login_endpoint_returns_bearer_token():
    """POST /api/auth/login must authenticate a seeded user and issue a JWT."""
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.mappings.return_value.first.return_value = {
        "id": 1,
        "username": "recruiter_talentops",
        "email": "recruiter@talentops.ai",
        "password_hash": hash_password("AdminSecret2026!"),
        "role": "recruiter",
        "locked_until": None,
    }
    mock_db.execute = AsyncMock(return_value=mock_res)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        ok = client.post(
            "/api/auth/login",
            json={"username": "recruiter_talentops", "password": "AdminSecret2026!"},
        )
        assert ok.status_code == 200
        body = ok.json()
        assert body["token_type"] == "bearer"
        assert body["user"]["role"] == "recruiter"
        payload = decode_access_token(body["access_token"])
        assert payload["sub"] == "1"

        bad = client.post(
            "/api/auth/login",
            json={"username": "recruiter_talentops", "password": "wrong"},
        )
        assert bad.status_code == 401
        assert bad.json()["detail"] == "INVALID_CREDENTIALS"
    finally:
        app.dependency_overrides.clear()


def test_protected_endpoint_rejects_missing_token_when_demo_disabled():
    """With DEMO_MODE off, protected routes must 401 without a Bearer token."""
    original = settings.DEMO_MODE
    settings.DEMO_MODE = False
    try:
        res = client.get("/api/candidates")
        assert res.status_code == 401
        assert "NOT_AUTHENTICATED" in res.json()["detail"]
    finally:
        settings.DEMO_MODE = original


def test_protected_endpoint_rejects_insufficient_role():
    """A valid token for a role outside the whitelist must be 403."""
    token = create_access_token({"sub": "9", "role": "hiring_manager", "username": "hm"})

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.mappings.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_res)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        res = client.post(
            "/api/slots/reserve",
            json={"slot_id": 1, "candidate_id": 1, "interviewer_id": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200 or res.status_code == 400
    finally:
        app.dependency_overrides.clear()

    # compliance_officer is NOT allowed to reserve slots per PRD Bab 8.1
    co_token = create_access_token({"sub": "10", "role": "compliance_officer", "username": "co"})
    app.dependency_overrides[get_db] = override_get_db
    try:
        res_co = client.post(
            "/api/slots/reserve",
            json={"slot_id": 1, "candidate_id": 1, "interviewer_id": 1},
            headers={"Authorization": f"Bearer {co_token}"},
        )
        assert res_co.status_code == 403
        assert "INSUFFICIENT_PERMISSIONS" in res_co.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_openapi_exposes_auth_routes():
    """Auth router must appear in the generated OpenAPI schema."""
    schema = app.openapi()
    assert "/api/auth/login" in schema["paths"]
    assert "/api/auth/me" in schema["paths"]
    tags = [t["name"] for t in schema.get("tags", [])]
    assert "Authentication & RBAC" in tags
