import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from app.core.auth import create_access_token
from app.core.database import get_db
from app.main import app

client = TestClient(app)

RECRUITER_TOKEN = create_access_token({"sub": "1", "role": "recruiter", "username": "recruiter_test"})
HIRING_MANAGER_TOKEN = create_access_token({"sub": "2", "role": "hiring_manager", "username": "hm_test"})
APPLICANT_TOKEN = create_access_token({"sub": "3", "role": "applicant", "username": "applicant_test"})


def make_mappings(rows):
    res = MagicMock()
    mapping_mock = MagicMock()
    mapping_mock.first.return_value = rows[0] if rows else None
    mapping_mock.__iter__.return_value = iter(rows)
    res.mappings.return_value = mapping_mock
    res.first.return_value = rows[0] if rows else None
    res.lastrowid = 101
    return res


@pytest.mark.asyncio
async def test_submit_interview_scorecard_rbac():
    # Applicant role is forbidden
    response = client.post(
        "/api/candidates/1/interview-scorecard",
        headers={"Authorization": f"Bearer {APPLICANT_TOKEN}"},
        json={
            "feedback_notes": "Great fit",
            "recommendation": "hire",
            "technical_score": 88.5,
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_submit_interview_scorecard_hire_success():
    mock_db = AsyncMock()
    executed_statements = []

    cand_row = {
        "id": 1,
        "job_id": 5,
        "masked_identifier": "#TK-9A8B7C",
        "status": "approved",
        "is_deleted": False,
        "version": 2,
        "encrypted_email": None,
        "encrypted_dek": b"fake_dek",
    }
    user_row = {"id": 1, "role": "recruiter", "username": "recruiter_test"}
    job_row = {"title": "Senior Backend Engineer"}

    async def fake_execute(statement, params=None):
        sql = str(statement)
        executed_statements.append((sql, params))
        upper = sql.upper()
        if "FROM USERS" in upper:
            return make_mappings([user_row])
        if "FROM CANDIDATES" in upper:
            return make_mappings([cand_row])
        if "FROM JOB_DESCRIPTIONS" in upper:
            return make_mappings([job_row])
        res = MagicMock()
        res.lastrowid = 99
        return res

    mock_db.execute = AsyncMock(side_effect=fake_execute)
    mock_db.commit = AsyncMock()

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        response = client.post(
            "/api/candidates/1/interview-scorecard",
            headers={"Authorization": f"Bearer {RECRUITER_TOKEN}"},
            json={
                "feedback_notes": "Strong system design skills.",
                "recommendation": "hire",
                "technical_score": 92.0,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["new_candidate_status"] == "hired"
        assert data["recommendation"] == "hire"
        assert data["technical_score"] == 92.0
        assert data["interviewer_id"] == 1

        mock_db.commit.assert_awaited_once()

        # Check candidate status update
        update_cand_stmts = [
            params for sql, params in executed_statements if "UPDATE CANDIDATES" in sql.upper()
        ]
        assert len(update_cand_stmts) == 1
        assert update_cand_stmts[0]["st"] == "hired"

        # Check scorecard insert
        insert_scorecard_stmts = [
            params for sql, params in executed_statements if "INSERT INTO INTERVIEW_SCORECARDS" in sql.upper()
        ]
        assert len(insert_scorecard_stmts) == 1
        assert insert_scorecard_stmts[0]["score"] == 92.0
        assert insert_scorecard_stmts[0]["rec"] == "hire"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_submit_interview_scorecard_reject_success():
    mock_db = AsyncMock()
    executed_statements = []

    cand_row = {
        "id": 2,
        "job_id": 5,
        "masked_identifier": "#TK-123456",
        "status": "approved",
        "is_deleted": False,
        "version": 1,
        "encrypted_email": None,
        "encrypted_dek": b"fake_dek",
    }
    user_row = {"id": 2, "role": "hiring_manager", "username": "hm_test"}
    job_row = {"title": "Senior Backend Engineer"}

    async def fake_execute(statement, params=None):
        sql = str(statement)
        executed_statements.append((sql, params))
        upper = sql.upper()
        if "FROM USERS" in upper:
            return make_mappings([user_row])
        if "FROM CANDIDATES" in upper:
            return make_mappings([cand_row])
        if "FROM JOB_DESCRIPTIONS" in upper:
            return make_mappings([job_row])
        res = MagicMock()
        res.lastrowid = 100
        return res

    mock_db.execute = AsyncMock(side_effect=fake_execute)
    mock_db.commit = AsyncMock()

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        response = client.post(
            "/api/candidates/2/interview-scorecard",
            headers={"Authorization": f"Bearer {HIRING_MANAGER_TOKEN}"},
            json={
                "feedback_notes": "Needs improvement in concurrency handling.",
                "recommendation": "reject",
                "technical_score": 58.0,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["new_candidate_status"] == "rejected"
        assert data["recommendation"] == "reject"
        assert data["technical_score"] == 58.0

        update_cand_stmts = [
            params for sql, params in executed_statements if "UPDATE CANDIDATES" in sql.upper()
        ]
        assert len(update_cand_stmts) == 1
        assert update_cand_stmts[0]["st"] == "rejected"
    finally:
        app.dependency_overrides.pop(get_db, None)
