"""
Sprint 5 Features Test Suite:
- Bias Analysis (FR-1 Job Analyzer)
- Evidence Graph (React Flow Schema)
- Unmask Governance (UU PDP)
- Slots Availability & Atomic Reservation
- Tamper-Evident Audit Trail
- OpenAPI Schema Validation
"""
import pytest
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend and root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.core.crypto import generate_dek, encrypt_dek, encrypt_pii

client = TestClient(app)


def test_openapi_schema_generation():
    """Verifies that FastAPI generates complete, valid OpenAPI schema without circular refs or errors."""
    schema = app.openapi()
    assert schema["info"]["title"] == "TalentOps AI Backend - Core Engine"
    assert schema["info"]["version"] == "2.5.2"
    paths = schema["paths"]

    # Verify all critical Sprint 5 endpoints exist in OpenAPI schema
    assert "/api/jobs/{job_id}/analyze-bias" in paths
    assert "/api/candidates/{candidate_id}/evidence-graph" in paths
    assert "/api/candidates/{candidate_id}/unmask" in paths
    assert "/api/slots/available" in paths
    assert "/api/slots/reserve" in paths
    assert "/api/audit-trail" in paths

    # Verify tags
    tags = [t["name"] for t in schema.get("tags", [])]
    assert "Public Career Portal" in tags
    assert "HR Recruiter Candidate Management" in tags
    assert "Job Intelligence & Policy Simulation" in tags
    assert "Calendar & Scheduling" in tags
    assert "Compliance & Audit Trail" in tags


@pytest.mark.asyncio
async def test_analyze_job_bias_endpoint():
    """Verifies FR-1 Job Analyzer scans gender, age, and institutional biases and calculates inclusivity score."""
    sample_biased_text = """
    Kami mencari Backend Ninja & Rockstar yang berpenampilan menarik dan tangguh.
    Kualifikasi:
    - Pria/Wanita, usia maksimal 27 tahun.
    - Lulusan PTN ternama dengan IPK minimal 3.75.
    - Siap kerja 24/7 di bawah tekanan ekstrem.
    """

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.mappings.return_value.first.return_value = {
        "id": 1,
        "title": "Senior Backend Engineer",
        "department": "Engineering",
        "raw_text": sample_biased_text,
        "flagged_ambiguities": None,
    }
    mock_db.execute = AsyncMock(return_value=mock_res)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        response = client.post(
            "/api/jobs/1/analyze-bias",
            json={"custom_text": sample_biased_text},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["job_id"] == 1
        assert data["total_bias_flags"] >= 4

        categories = [f["category"] for f in data["bias_findings"]]
        assert "GENDER_EXCLUSIVE_TERMS" in categories
        assert "AGE_DISCRIMINATION" in categories
        assert "INSTITUTION_PRESTIGE_BIAS" in categories
        assert "AMBIGUOUS_WORK_EXPECTATIONS" in categories

        # Score must reflect penalties
        assert data["inclusivity_score"] < 70
        assert data["inclusivity_rating"] == "NEEDS_REVISION"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_evidence_graph_react_flow_schema():
    """Verifies GET /api/candidates/{id}/evidence-graph returns nodes and edges formatted for React Flow."""
    mock_db = AsyncMock()

    # Candidate mapping
    mock_cand = {
        "id": 10,
        "job_id": 1,
        "masked_identifier": "#TK-A1B2C3",
        "overall_score": 88.5,
        "confidence_level": "HIGH",
        "unresolved_risk": "LOW",
        "recommendation": "STRONG_MATCH",
        "github_url": "https://github.com/candidate/repo",
        "portfolio_url": None,
        "is_deleted": False,
    }
    # Evidence mappings
    mock_evidence = [
        {
            "id": 1,
            "dimension": "SKILL",
            "target_competency": "FastAPI",
            "claim_text": "Built async microservices handling 2k rps",
            "evidence_source": "CV Page 1",
            "score_contribution": 100.0,
            "confidence": 1.0,
        },
        {
            "id": 2,
            "dimension": "EXPERIENCE",
            "target_competency": "Backend Engineer",
            "claim_text": "3 years experience in fintech",
            "evidence_source": "CV Page 2",
            "score_contribution": 60.0,
            "confidence": 0.8,
        },
    ]

    mock_db.execute.side_effect = [
        # 1. Candidate lookup
        AsyncMock(mappings=lambda: AsyncMock(first=lambda: mock_cand)),
        # 2. Evidence lookup
        AsyncMock(mappings=lambda: mock_evidence),
        # 3. Anomalies lookup
        AsyncMock(mappings=lambda: []),
    ]

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        response = client.get("/api/candidates/10/evidence-graph")
        assert response.status_code == 200
        data = response.json()
        assert data["candidate_id"] == 10
        assert data["masked_identifier"] == "#TK-A1B2C3"

        graph = data["graph"]
        nodes = graph["nodes"]
        edges = graph["edges"]

        # Root + 4 dimensions + 2 claims = 7 nodes
        assert len(nodes) == 7
        node_types = {n["type"] for n in nodes}
        assert "candidateRoot" in node_types
        assert "dimensionNode" in node_types
        assert "evidenceClaimNode" in node_types

        # Verify edges link root to dimension and dimension to evidence
        assert len(edges) >= 6
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_unmask_candidate_pii_governance():
    """Verifies that unmasking candidate PII strictly adheres to UU PDP blind review governance."""
    dek = generate_dek()
    enc_dek = encrypt_dek(dek)
    enc_name = encrypt_pii("Budi Santoso", dek)
    enc_email = encrypt_pii("budi.santoso@example.com", dek)
    enc_phone = encrypt_pii("081234567890", dek)

    mock_db = AsyncMock()

    # 1. Test rejection during blind review (status waiting_approval, recruiter role)
    mock_cand_blind = {
        "id": 15,
        "masked_identifier": "#TK-BUDI01",
        "status": "waiting_approval",
        "encrypted_name": enc_name,
        "encrypted_email": enc_email,
        "encrypted_phone": enc_phone,
        "encrypted_dek": enc_dek,
        "is_deleted": False,
    }
    mock_res_blind = MagicMock()
    mock_res_blind.mappings.return_value.first.return_value = mock_cand_blind
    mock_db.execute = AsyncMock(return_value=mock_res_blind)

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        # Rejection test: recruiter cannot unmask before approval
        res_reject = client.post(
            "/api/candidates/15/unmask",
            data={"reason": "Need to call candidate", "reviewer_role": "recruiter"},
        )
        assert res_reject.status_code == 403
        assert "UNMASK_FORBIDDEN_DURING_BLIND_REVIEW" in res_reject.json()["detail"]

        # Success test 1: Compliance Officer can unmask for audit purposes
        res_compliance = client.post(
            "/api/candidates/15/unmask",
            data={"reason": "Legal audit investigation", "reviewer_role": "compliance_officer"},
        )
        assert res_compliance.status_code == 200
        unmasked = res_compliance.json()["unmasked_data"]
        assert unmasked["name"] == "Budi Santoso"
        assert unmasked["email"] == "budi.santoso@example.com"
        assert unmasked["phone"] == "081234567890"

        # Success test 2: Approved candidate can be unmasked by recruiter for interview preparation
        mock_cand_approved = dict(mock_cand_blind)
        mock_cand_approved["status"] = "approved"
        mock_res_approved = MagicMock()
        mock_res_approved.mappings.return_value.first.return_value = mock_cand_approved
        mock_db.execute = AsyncMock(return_value=mock_res_approved)

        res_approved = client.post(
            "/api/candidates/15/unmask",
            data={"reason": "Interview preparation and dispatch", "reviewer_role": "recruiter"},
        )
        assert res_approved.status_code == 200
        assert res_approved.json()["unmasked_data"]["name"] == "Budi Santoso"
    finally:
        app.dependency_overrides.clear()
