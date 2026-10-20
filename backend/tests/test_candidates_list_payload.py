"""
Contract test for GET /api/candidates dashboard payload.

The frontend dashboard table renders job_title, department, github_url, flags, and
key_technologies. Those were previously absent from the API response, which forced
the UI to fall back to mock data. This suite locks the contract so the mock removal
in the frontend stays safe.

Also asserts the relation lookups are batched (one query for anomalies, one for
evidence) rather than issued per candidate.
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient

from app.core.auth import create_access_token
from app.core.database import get_db
from app.main import app

client = TestClient(app)

RECRUITER_TOKEN = create_access_token({"sub": "1", "role": "recruiter", "username": "recruiter_talentops"})
HEADERS = {"Authorization": f"Bearer {RECRUITER_TOKEN}"}


def make_result(rows):
    """Mimics a SQLAlchemy Result whose .mappings() yields row dicts."""
    res = MagicMock()
    res.mappings.return_value = list(rows)
    return res


def build_mock_db(candidate_rows, anomaly_rows, evidence_rows, executed=None):
    """
    Routes queries by SQL content rather than call order.

    The auth dependency issues its own `SELECT ... FROM users` before the handler
    runs, so positional dispatch would hand the wrong result set to the endpoint.
    """
    mock_db = AsyncMock()

    async def fake_execute(statement, params=None):
        sql = str(statement)
        if executed is not None:
            executed.append(sql)
        upper = sql.upper()

        if "FROM USERS" in upper:
            return make_result([{"id": 1, "username": "recruiter_talentops",
                                 "email": "recruiter@talentops.ai", "role": "recruiter"}])
        if "FROM CANDIDATE_ANOMALIES" in upper:
            return make_result(anomaly_rows)
        if "FROM CANDIDATE_EVIDENCE" in upper:
            return make_result(evidence_rows)
        if "FROM CANDIDATES" in upper:
            return make_result(candidate_rows)
        return make_result([])

    mock_db.execute = AsyncMock(side_effect=fake_execute)
    return mock_db


CANDIDATE_ROW = {
    "id": 7,
    "job_id": 3,
    "masked_identifier": "#TK-A1B2C3",
    "tracking_token": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "overall_score": 88.5,
    "confidence_level": "HIGH",
    "unresolved_risk": "LOW",
    "recommendation": "STRONG_MATCH",
    "triage_priority": "HIGH_ATTENTION",
    "status": "waiting_approval",
    "dimension_scores": {"SKILL": 90, "EXPERIENCE": 85, "EDUCATION": 80, "PORTFOLIO": 95},
    "is_deleted": False,
    "created_at": None,
    "github_url": "https://github.com/budi",
    "portfolio_url": "https://budi.dev",
    "job_title": "Senior Backend Engineer",
    "job_department": "Core Engineering",
}


def endpoint_queries(executed):
    """Filters out the auth dependency's users lookup, leaving only handler queries."""
    return [q for q in executed if "FROM USERS" not in q.upper()]


def override(mock_db):
    async def _override():
        yield mock_db

    app.dependency_overrides[get_db] = _override


def test_list_candidates_returns_dashboard_fields():
    """Every field the dashboard renders must be present in the response."""
    executed = []
    mock_db = build_mock_db(
        candidate_rows=[CANDIDATE_ROW],
        anomaly_rows=[
            {"candidate_id": 7, "anomaly_type": "PDF_WHITE_TEXT"},
            {"candidate_id": 7, "anomaly_type": "PROMPT_INJECTION"},
        ],
        evidence_rows=[
            {"candidate_id": 7, "target_competency": "FastAPI"},
            {"candidate_id": 7, "target_competency": "PostgreSQL"},
            {"candidate_id": 7, "target_competency": "FastAPI"},  # duplicate must dedupe
        ],
        executed=executed,
    )
    override(mock_db)
    try:
        res = client.get("/api/candidates?limit=50", headers=HEADERS)
        assert res.status_code == 200
        body = res.json()
        assert body["count"] == 1
        row = body["data"][0]

        # Fields that were missing and caused the mock fallback
        assert row["job_title"] == "Senior Backend Engineer"
        assert row["department"] == "Core Engineering"
        assert row["github_url"] == "https://github.com/budi"
        assert row["portfolio_url"] == "https://budi.dev"
        assert row["flags"] == ["PDF_WHITE_TEXT", "PROMPT_INJECTION"]
        assert row["key_technologies"] == ["FastAPI", "PostgreSQL"]

        # Pre-existing contract must not regress
        assert row["id"] == 7
        assert row["masked_identifier"] == "#TK-A1B2C3"
        assert row["tracking_token"] == "7c9e6679-7425-40de-944b-e07fc1f90ae7"
        assert row["overall_score"] == 88.5
        assert row["recommendation"] == "STRONG_MATCH"
        assert row["dimension_scores"]["SKILL"] == 90
    finally:
        app.dependency_overrides.clear()


def test_list_candidates_joins_job_descriptions():
    """job_title must come from a JOIN, not a hardcoded value or per-row lookup."""
    executed = []
    mock_db = build_mock_db([CANDIDATE_ROW], [], [], executed=executed)
    override(mock_db)
    try:
        client.get("/api/candidates", headers=HEADERS)
        main_query = endpoint_queries(executed)[0].upper()
        assert "JOIN JOB_DESCRIPTIONS" in main_query
        assert "JOB_TITLE" in main_query
    finally:
        app.dependency_overrides.clear()


def test_list_candidates_batches_relation_queries():
    """Three candidates must not produce three anomaly + three evidence queries."""
    rows = [dict(CANDIDATE_ROW, id=i, masked_identifier=f"#TK-{i:06d}") for i in (1, 2, 3)]
    executed = []
    mock_db = build_mock_db(rows, [], [], executed=executed)
    override(mock_db)
    try:
        res = client.get("/api/candidates", headers=HEADERS)
        assert res.status_code == 200
        # 1 main query + 1 anomalies + 1 evidence, regardless of row count
        handler_queries = endpoint_queries(executed)
        assert len(handler_queries) == 3
        assert "FROM CANDIDATES" in handler_queries[0].upper()
        assert "CANDIDATE_ANOMALIES" in handler_queries[1].upper()
        assert "CANDIDATE_EVIDENCE" in handler_queries[2].upper()
    finally:
        app.dependency_overrides.clear()


def test_list_candidates_empty_result_skips_relation_queries():
    """An empty page must not issue pointless IN () queries."""
    executed = []
    mock_db = build_mock_db([], [], [], executed=executed)
    override(mock_db)
    try:
        res = client.get("/api/candidates", headers=HEADERS)
        assert res.status_code == 200
        assert res.json()["data"] == []
        assert len(endpoint_queries(executed)) == 1  # only the main query
    finally:
        app.dependency_overrides.clear()


def test_list_candidates_candidate_without_relations():
    """A candidate with no anomalies/evidence yields empty lists, not null."""
    mock_db = build_mock_db([CANDIDATE_ROW], [], [])
    override(mock_db)
    try:
        row = client.get("/api/candidates", headers=HEADERS).json()["data"][0]
        assert row["flags"] == []
        assert row["key_technologies"] == []
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("query,expected", [
    ("?job_id=3", "C.JOB_ID = :JOB_ID"),
    ("?status=waiting_approval", "C.STATUS = :STATUS"),
])
def test_list_candidates_filters_use_table_alias(query, expected):
    """Filters must be aliased now that candidates is joined with job_descriptions."""
    executed = []
    mock_db = build_mock_db([], [], [], executed=executed)
    override(mock_db)
    try:
        client.get(f"/api/candidates{query}", headers=HEADERS)
        assert expected in endpoint_queries(executed)[0].upper()
    finally:
        app.dependency_overrides.clear()
