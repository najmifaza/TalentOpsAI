"""
SSE stream authorization guard:
- GET /api/candidates/stream/{id} must never stream without a valid single-use ticket
- GET /api/candidates/{id}/trace-stream must reject missing/invalid/reused tickets
- POST /api/candidates/{id}/sse-ticket requires an authenticated RBAC role
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import create_access_token
from app.core.broadcaster import sse_broadcaster
from app.core.database import get_db

client = TestClient(app)


def _auth_headers(role: str = "recruiter", user_id: int = 1) -> dict:
    token = create_access_token({"sub": str(user_id), "role": role, "username": f"{role}_test"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.parametrize("path", ["/api/candidates/stream/7", "/api/candidates/7/trace-stream"])
def test_stream_requires_ticket(path):
    """Both SSE paths must refuse to open a stream with no ticket at all."""
    res = client.get(path)
    assert res.status_code == 401
    assert res.json()["detail"] == "MISSING_SSE_STREAM_TICKET"


@pytest.mark.parametrize("path", ["/api/candidates/stream/7", "/api/candidates/7/trace-stream"])
def test_stream_rejects_forged_ticket(path):
    """A ticket never issued by the broadcaster must not open a stream."""
    res = client.get(path, params={"ticket": "00000000-0000-0000-0000-000000000000"})
    assert res.status_code == 403
    assert res.json()["detail"] == "INVALID_OR_EXPIRED_SSE_TICKET"


def test_ticket_is_single_use():
    """A burnt ticket must not be accepted a second time (burn-on-read)."""
    import asyncio

    ticket = asyncio.get_event_loop().run_until_complete(sse_broadcaster.issue_ticket(candidate_id=7))
    assert asyncio.get_event_loop().run_until_complete(
        sse_broadcaster.validate_and_burn_ticket(candidate_id=7, ticket=ticket)
    ) is True
    assert asyncio.get_event_loop().run_until_complete(
        sse_broadcaster.validate_and_burn_ticket(candidate_id=7, ticket=ticket)
    ) is False


def test_sse_ticket_endpoint_requires_auth():
    """Ticket issuance must demand a Bearer token now that DEMO_MODE is off."""
    res = client.post("/api/candidates/7/sse-ticket")
    assert res.status_code == 401


def test_sse_ticket_endpoint_forbidden_role():
    """Roles outside the streaming allow-list must be rejected with 403."""
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.mappings.return_value.first.return_value = {"id": 7, "is_deleted": False}
    mock_db.execute = AsyncMock(return_value=mock_res)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        res = client.post("/api/candidates/7/sse-ticket", headers=_auth_headers("auditor"))
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_stream_alias_hidden_from_openapi():
    """The legacy alias must not be advertised in the public schema."""
    paths = app.openapi()["paths"]
    assert "/api/candidates/stream/{candidate_id}" not in paths
    assert "/api/candidates/{candidate_id}/trace-stream" in paths
    assert "/api/candidates/{candidate_id}/sse-ticket" in paths
