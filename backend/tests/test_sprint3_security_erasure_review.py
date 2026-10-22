import pytest
from unittest.mock import AsyncMock, MagicMock
from app.api.candidates import review_candidate, right_to_erasure_candidate
from app.api.careers import withdraw_application
from app.core.erasure import execute_talentops_erasure


def make_mappings(row_dict):
    """Helper to simulate SQLAlchemy mappings().first() and fetchall()."""
    mock_res = MagicMock()
    mock_mappings = MagicMock()
    mock_mappings.first.return_value = row_dict
    mock_mappings.fetchall.return_value = [row_dict] if row_dict else []
    mock_res.mappings.return_value = mock_mappings
    mock_res.first.return_value = (row_dict["id"],) if row_dict and "id" in row_dict else (1,)
    return mock_res


@pytest.mark.asyncio
async def test_human_review_lock_hierarchy_success():
    """Verifies review_candidate endpoint lock hierarchy and status update."""
    mock_db = AsyncMock()

    user_row = {"id": 1, "role": "recruiter"}
    slot_row = {"id": 5, "status": "available", "candidate_id": None}
    cand_row = {"id": 10, "masked_identifier": "#TK-A1B2C3", "status": "waiting_approval", "is_deleted": False, "version": 1}

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM USERS" in sql:
            return make_mappings(user_row)
        elif "FROM INTERVIEW_SLOTS" in sql:
            return make_mappings(slot_row)
        elif "FROM CANDIDATES" in sql:
            return make_mappings(cand_row)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)
    mock_db.commit = AsyncMock()

    res = await review_candidate(
        candidate_id=10,
        decision="APPROVED_DISPATCH",
        notes="Candidate passed all technical criteria with high confidence.",
        slot_id=5,
        reviewer_id=1,
        db=mock_db,
    )

    assert res["status"] == "success"
    assert res["candidate_id"] == 10
    assert res["decision"] == "APPROVED_DISPATCH"
    assert res["new_candidate_status"] == "approved"
    assert res["booked_slot_id"] == 5
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_unified_crypto_shredding_erasure_service():
    """Verifies execute_talentops_erasure logic according to UU PDP No. 27/2022."""
    mock_db = AsyncMock()
    cand_row = {"id": 10, "masked_identifier": "#TK-A1B2C3", "is_deleted": False, "resume_file_path": None}

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql:
            return make_mappings(cand_row)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    res = await execute_talentops_erasure(
        db=mock_db,
        candidate_id=10,
        reason="APPLICANT_VOLUNTARY_WITHDRAWAL_VIA_PORTAL",
        ip_address="192.168.1.100",
        user_id=1,
    )

    assert res["success"] is True
    assert res["candidate_id"] == 10
    assert res["is_deleted"] is True
    assert res["masked_identifier"] == "#TK-A1B2C3"

    # Verify SQL calls occurred (UPDATE candidates, DELETE evidence, DELETE assessments, UPDATE slots, INSERT audit)
    assert mock_db.execute.await_count >= 5


@pytest.mark.asyncio
async def test_withdraw_application_via_token():
    """Verifies public portal withdraw_application endpoint."""
    mock_db = AsyncMock()
    cand_row = {"id": 10, "masked_identifier": "#TK-A1B2C3", "is_deleted": False, "resume_file_path": None}

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql:
            return make_mappings(cand_row)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)
    mock_db.commit = AsyncMock()

    mock_request = MagicMock()
    mock_request.headers.get.return_value = "10.0.0.5"

    res = await withdraw_application(
        request=mock_request,
        tracking_token="mock_uuid_tracking_token_12345",
        db=mock_db,
    )

    assert res["status"] == "success"
    assert res["is_deleted"] is True
    assert res["masked_identifier"] == "#TK-A1B2C3"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_calendar_expired_cleaner_task():
    """Verifies PRD Bab 6.3 cleaner task releases expired tentative slots."""
    from app.adapters.calendar import mock_calendar_adapter

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.rowcount = 2
    mock_db.execute = AsyncMock(return_value=mock_result)

    freed = await mock_calendar_adapter.release_expired_tentative_slots(mock_db)
    assert freed == 2
    mock_db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_sse_ticket_issuance_and_validation():
    """Verifies single-use ticket issuance (TTL 60s) and burn-on-read validation (PRD Bab 8.2)."""
    from app.core.broadcaster import sse_broadcaster

    candidate_id = 42

    # 1. Issue ticket
    ticket = await sse_broadcaster.issue_ticket(candidate_id=candidate_id)
    assert isinstance(ticket, str) and len(ticket) > 10

    # 2. Reject wrong candidate
    assert await sse_broadcaster.validate_and_burn_ticket(candidate_id=99, ticket=ticket) is False

    # 3. Successful validation burns ticket
    assert await sse_broadcaster.validate_and_burn_ticket(candidate_id=candidate_id, ticket=ticket) is True

    # 4. Immediate second attempt fails (single-use burned)
    assert await sse_broadcaster.validate_and_burn_ticket(candidate_id=candidate_id, ticket=ticket) is False


@pytest.mark.asyncio
async def test_sse_ticket_endpoints():
    """Verifies POST /api/candidates/{id}/sse-ticket and GET /{id}/trace-stream validation."""
    from app.api.candidates import issue_sse_stream_ticket, trace_stream_agent_execution
    from fastapi import HTTPException

    mock_db = AsyncMock()
    cand_row = {"id": 10, "is_deleted": False}

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        if "FROM CANDIDATES" in sql:
            return make_mappings(cand_row)
        return MagicMock()

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    # 1. Issue ticket endpoint
    res = await issue_sse_stream_ticket(candidate_id=10, db=mock_db)
    assert res["status"] == "success"
    assert res["candidate_id"] == 10
    ticket = res["ticket"]
    assert ticket is not None

    # 2. Trace stream without ticket raises 401
    with pytest.raises(HTTPException) as exc_401:
        await trace_stream_agent_execution(candidate_id=10, ticket=None)
    assert exc_401.value.status_code == 401

    # 3. Trace stream with valid ticket returns StreamingResponse
    stream_res = await trace_stream_agent_execution(candidate_id=10, ticket=ticket)
    assert stream_res.status_code == 200
    assert stream_res.media_type == "text/event-stream"

    # 4. Second attempt with burned ticket raises 403
    with pytest.raises(HTTPException) as exc_403:
        await trace_stream_agent_execution(candidate_id=10, ticket=ticket)
    assert exc_403.value.status_code == 403
