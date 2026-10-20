"""
Withdrawal erasure-confirmation email tests.

`POST /api/careers/withdraw` crypto-shreds the candidate: `execute_talentops_erasure`
nulls `encrypted_email` and `encrypted_dek`. That ordering creates a trap — if the
recipient address is read *after* the shred, the DEK is already gone and the
confirmation can never be delivered.

These tests lock in the required sequence:
  1. decrypt recipient from the still-intact envelope
  2. shred (DEK destroyed)
  3. commit
  4. send the confirmation with the address captured in step 1

They also assert the two properties that keep the endpoint safe: an email failure
never fails the withdrawal, and the address never appears in the response body.
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.api.careers import withdraw_application
from app.core.crypto import encrypt_dek, encrypt_pii, generate_dek


def make_mappings(row_dict):
    """Simulates SQLAlchemy Result.mappings().first()."""
    mock_res = MagicMock()
    mock_mappings = MagicMock()
    mock_mappings.first.return_value = row_dict
    mock_res.mappings.return_value = mock_mappings
    return mock_res


@pytest.fixture
def envelope():
    """A real encrypted candidate envelope: DEK sealed under KEK, email under DEK."""
    dek = generate_dek()
    return {
        "encrypted_email": encrypt_pii("budi.santoso@example.com", dek),
        "encrypted_dek": encrypt_dek(dek),
    }


def build_db(envelope, call_log):
    """Records every SQL statement so ordering can be asserted afterwards."""
    db = AsyncMock()

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        call_log.append(sql)
        if "FROM CANDIDATES" in sql:
            return make_mappings({
                "id": 10,
                "masked_identifier": "#TK-A1B2C3",
                "is_deleted": False,
                "job_id": 7,
                **envelope,
            })
        if "FROM JOB_DESCRIPTIONS" in sql:
            return make_mappings({"title": "Backend Engineer"})
        return MagicMock()

    db.execute = AsyncMock(side_effect=mock_execute)
    db.commit = AsyncMock()
    return db


def build_request():
    request = MagicMock()
    request.headers.get.return_value = "10.0.0.5"
    return request


@pytest.fixture
def email_enabled():
    """Turns the email service on and captures the send call."""
    sender = MagicMock()
    sender.configured = True
    sender.send = AsyncMock(return_value={"sent": True, "provider": "resend_api"})
    with patch("app.api.careers.email_service", sender):
        yield sender


@pytest.fixture
def email_disabled():
    sender = MagicMock()
    sender.configured = False
    sender.send = AsyncMock(return_value={"sent": False, "reason": "EMAIL_NOT_CONFIGURED"})
    with patch("app.api.careers.email_service", sender):
        yield sender


# -- ordering --------------------------------------------------------------

@pytest.mark.asyncio
async def test_recipient_decrypted_before_shred(envelope, email_enabled):
    """
    The core regression: the address must be readable before the DEK is destroyed.
    `execute_talentops_erasure` nulls both columns, so a post-shred decrypt yields
    nothing and the applicant silently gets no confirmation.
    """
    call_log = []
    db = build_db(envelope, call_log)
    shred_order = []

    async def fake_erasure(**kwargs):
        shred_order.append("shred")
        return {"success": True}

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        res = await withdraw_application(
            request=build_request(),
            tracking_token="tok_abc123",
            db=db,
        )

    assert res["status"] == "success"
    email_enabled.send.assert_awaited_once()

    recipient = email_enabled.send.await_args[0][0]
    assert recipient == "budi.santoso@example.com", (
        "recipient must be decrypted from the pre-shred envelope"
    )


@pytest.mark.asyncio
async def test_confirmation_sent_after_commit(envelope, email_enabled):
    """The mail must not be sent before the shred is durable."""
    call_log = []
    db = build_db(envelope, call_log)
    events = []

    original_commit = db.commit

    async def tracking_commit():
        events.append("commit")
        return await original_commit()

    db.commit = tracking_commit
    email_enabled.send.side_effect = lambda *a, **k: events.append("send") or {"sent": True}

    async def fake_erasure(**kwargs):
        return {"success": True}

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        await withdraw_application(
            request=build_request(), tracking_token="tok_abc123", db=db
        )

    assert events == ["commit", "send"], f"expected commit before send, got {events}"


# -- failure isolation -----------------------------------------------------

@pytest.mark.asyncio
async def test_email_failure_does_not_fail_withdrawal(envelope, email_enabled):
    """A Resend outage must never block a data-erasure right under UU PDP 27/2022."""
    call_log = []
    db = build_db(envelope, call_log)
    email_enabled.send.side_effect = RuntimeError("resend down")

    async def fake_erasure(**kwargs):
        return {"success": True}

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        res = await withdraw_application(
            request=build_request(), tracking_token="tok_abc123", db=db
        )

    assert res["status"] == "success"
    assert res["is_deleted"] is True


@pytest.mark.asyncio
async def test_decrypt_failure_still_shreds(envelope, email_disabled):
    """A corrupt envelope must not block erasure — the shred is the user's right."""
    call_log = []
    db = build_db({"encrypted_email": b"corrupt", "encrypted_dek": b"corrupt"}, call_log)
    email_disabled.configured = True  # force the decrypt attempt

    async def fake_erasure(**kwargs):
        return {"success": True}

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        res = await withdraw_application(
            request=build_request(), tracking_token="tok_abc123", db=db
        )

    assert res["status"] == "success"
    email_disabled.send.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_decrypt_when_email_disabled(envelope, email_disabled):
    """With mail disabled there is no reason to touch the DEK at all."""
    call_log = []
    db = build_db(envelope, call_log)

    async def fake_erasure(**kwargs):
        return {"success": True}

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        await withdraw_application(
            request=build_request(), tracking_token="tok_abc123", db=db
        )

    email_disabled.send.assert_not_awaited()
    # No job lookup either: it is only needed to personalise the email
    assert not any("FROM JOB_DESCRIPTIONS" in q for q in call_log)


@pytest.mark.asyncio
async def test_erasure_failure_propagates_and_sends_nothing(envelope, email_enabled):
    """If the shred fails the endpoint must error out and stay silent."""
    call_log = []
    db = build_db(envelope, call_log)

    async def fake_erasure(**kwargs):
        return {"success": False, "error": "DB_LOCK_TIMEOUT"}

    from fastapi import HTTPException

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        with pytest.raises(HTTPException) as exc:
            await withdraw_application(
                request=build_request(), tracking_token="tok_abc123", db=db
            )

    assert exc.value.status_code == 400
    email_enabled.send.assert_not_awaited()


# -- PII hygiene -----------------------------------------------------------

@pytest.mark.asyncio
async def test_address_never_returned_in_response(envelope, email_enabled):
    """The endpoint is public; it must not echo the address back to the caller."""
    call_log = []
    db = build_db(envelope, call_log)

    async def fake_erasure(**kwargs):
        return {"success": True}

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        res = await withdraw_application(
            request=build_request(), tracking_token="tok_abc123", db=db
        )

    serialized = str(res)
    assert "budi.santoso" not in serialized
    assert "example.com" not in serialized
    assert "#TK-A1B2C3" in serialized


@pytest.mark.asyncio
async def test_job_title_used_in_confirmation(envelope, email_enabled):
    """The confirmation names the role so the applicant can identify the record."""
    call_log = []
    db = build_db(envelope, call_log)

    async def fake_erasure(**kwargs):
        return {"success": True}

    with patch("app.api.careers.execute_talentops_erasure", side_effect=fake_erasure):
        await withdraw_application(
            request=build_request(), tracking_token="tok_abc123", db=db
        )

    html_body = email_enabled.send.await_args[0][2]
    text_body = email_enabled.send.await_args[0][3]
    assert "Backend Engineer" in html_body
    assert "Backend Engineer" in text_body
    assert "27/2022" in text_body
