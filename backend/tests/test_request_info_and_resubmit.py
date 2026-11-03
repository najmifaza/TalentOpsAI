import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.core.email_templates import request_additional_info
from app.api.candidates import (
    _notify_candidate_decision,
    resubmit_candidate_info,
    ResubmitInfoRequest,
)


def make_mappings(row_dict):
    mock_res = MagicMock()
    mock_mappings = MagicMock()
    mock_mappings.first.return_value = row_dict
    mock_mappings.fetchall.return_value = [row_dict] if row_dict else []
    mock_res.mappings.return_value = mock_mappings
    mock_res.first.return_value = (row_dict["id"],) if row_dict and "id" in row_dict else (1,)
    return mock_res


def test_request_additional_info_template():
    subject, html, text = request_additional_info(
        masked_identifier="#TK-123456",
        job_title="Senior Backend Engineer",
        note="Harap sertakan link repo GitHub portofolio terbaru.",
    )
    assert "Permintaan Informasi Tambahan" in subject
    assert "Senior Backend Engineer" in subject
    assert "#TK-123456" in html
    assert "#TK-123456" in text
    assert "Harap sertakan link repo" in html
    assert "Harap sertakan link repo" in text
    assert "portal pelacakan" in html.lower()


@pytest.mark.asyncio
async def test_notify_candidate_decision_request_info():
    mock_cand = {
        "masked_identifier": "#TK-998877",
        "encrypted_dek": b"mock_dek",
        "encrypted_email": b"mock_email",
    }

    mock_email = MagicMock()
    mock_email.configured = True
    mock_email.send = AsyncMock(return_value={"sent": True, "provider": "mock", "reason": None})

    with patch("app.api.candidates.email_service", mock_email), \
         patch("app.api.candidates.decrypt_dek", return_value=b"plain_dek"), \
         patch("app.api.candidates.decrypt_pii", return_value="candidate@example.com"):

        res = await _notify_candidate_decision(
            candidate=mock_cand,
            job_title="DevOps Specialist",
            decision="REQUEST_INFO",
            slot_id=None,
            notes="Tolong upload sertifikat AWS.",
            db=None,
        )

        assert res["sent"] is True
        mock_email.send.assert_awaited_once()
        assert mock_email.send.await_args is not None
        recipient, subject, html, text = mock_email.send.await_args[0]
        assert recipient == "candidate@example.com"
        assert "Permintaan Informasi Tambahan - DevOps Specialist" in subject
        assert "Tolong upload sertifikat AWS." in html
        assert "#TK-998877" in text


@pytest.mark.asyncio
async def test_resubmit_success():
    mock_db = AsyncMock()
    cand_row = {
        "id": 42,
        "masked_identifier": "#TK-424242",
        "tracking_token": "valid_secret_token_123",
        "status": "request_info",
        "version": 2,
        "is_deleted": False,
    }
    rev_row = {"reviewer_id": 7}

    executed_sqls = []

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        executed_sqls.append((sql, params))
        if "FROM CANDIDATES" in sql:
            return make_mappings(cand_row)
        elif "FROM HUMAN_REVIEWS" in sql:
            return make_mappings(rev_row)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)
    mock_db.commit = AsyncMock()

    payload = ResubmitInfoRequest(
        tracking_token="valid_secret_token_123",
        additional_info="Berikut link portfolio: https://github.com/my-profile",
    )

    result = await resubmit_candidate_info(
        candidate_id=42,
        payload=payload,
        db=mock_db,
    )

    assert result["status"] == "resubmitted"
    assert result["masked_identifier"] == "#TK-424242"
    mock_db.commit.assert_awaited_once()

    # Check update status to waiting_approval
    update_executed = any(
        "UPDATE CANDIDATES" in sql and "WAITING_APPROVAL" in sql and params.get("cid") == 42
        for sql, params in executed_sqls
    )
    assert update_executed

    # Check insert into human_reviews with RESUBMIT
    insert_executed = any(
        "INSERT INTO HUMAN_REVIEWS" in sql and params.get("notes") == payload.additional_info
        for sql, params in executed_sqls
    )
    assert insert_executed


@pytest.mark.asyncio
async def test_resubmit_invalid_tracking_token():
    mock_db = AsyncMock()
    cand_row = {
        "id": 42,
        "masked_identifier": "#TK-424242",
        "tracking_token": "correct_token_123",
        "status": "request_info",
        "version": 2,
        "is_deleted": False,
    }

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql:
            return make_mappings(cand_row)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    payload = ResubmitInfoRequest(
        tracking_token="wrong_token_xyz",
        additional_info="Some info",
    )

    with pytest.raises(HTTPException) as exc_info:
        await resubmit_candidate_info(candidate_id=42, payload=payload, db=mock_db)

    assert exc_info.value.status_code == 403
    assert "INVALID_TRACKING_TOKEN" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_resubmit_invalid_candidate_status():
    mock_db = AsyncMock()
    cand_row = {
        "id": 42,
        "masked_identifier": "#TK-424242",
        "tracking_token": "valid_token_123",
        "status": "waiting_approval",  # Not in request_info
        "version": 2,
        "is_deleted": False,
    }

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql:
            return make_mappings(cand_row)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    payload = ResubmitInfoRequest(
        tracking_token="valid_token_123",
        additional_info="Some info",
    )

    with pytest.raises(HTTPException) as exc_info:
        await resubmit_candidate_info(candidate_id=42, payload=payload, db=mock_db)

    assert exc_info.value.status_code == 400
    assert "INVALID_STATUS_FOR_RESUBMISSION" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_resubmit_candidate_not_found():
    mock_db = AsyncMock()

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql:
            return make_mappings(None)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    payload = ResubmitInfoRequest(
        tracking_token="valid_token_123",
        additional_info="Some info",
    )

    with pytest.raises(HTTPException) as exc_info:
        await resubmit_candidate_info(candidate_id=999, payload=payload, db=mock_db)

    assert exc_info.value.status_code == 404
