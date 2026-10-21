import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.scoring import DeterministicScoringEngine
from app.schemas.extraction import CandidateExtractionSchema


def test_every_cv_technology_reaches_evidence_graph():
    """A CV mentioning Next.js must surface it even when the posting asks for React.

    Regression guard: evidence used to be emitted per job requirement, so anything
    outside `core_competencies` never appeared in the dossier or the evidence graph.
    """
    claims = [
        {
            "dimension": "SKILL",
            "technology": "React",
            "has_implementation_detail": True,
            "context_narrative": "built dashboard using react",
            "metric_string": None,
            "repo_url": None,
            "source_location": "Pengalaman",
        },
        {
            "dimension": "SKILL",
            "technology": "Next.js",
            "has_implementation_detail": True,
            "context_narrative": "migrated portal to next.js app router",
            "metric_string": None,
            "repo_url": None,
            "source_location": "Proyek",
        },
    ]

    _score, records = DeterministicScoringEngine.calculate_skill_score(
        claims=claims,
        core_competencies=["React"],
        verified_github_repos={},
    )

    technologies = {r["target_competency"] for r in records}
    assert "React" in technologies
    assert "Next.js" in technologies, "CV technology missing from evidence records"

    by_tech = {r["target_competency"]: r for r in records}
    assert by_tech["React"]["matched_requirement"] == "React"
    assert by_tech["Next.js"]["matched_requirement"] is None
    assert by_tech["Next.js"]["score_contribution"] == 0.0
    assert by_tech["Next.js"]["verified"] is True
    assert by_tech["Next.js"]["claim_text"] == "migrated portal to next.js app router"


def test_substring_guard_drops_unverified_narrative():
    """A hallucinated narrative must not survive as a renderable 'quote'."""
    cv_text = "Backend Engineer\nBuilt services using FastAPI and PostgreSQL."
    payload = {
        "github_url": None,
        "portfolio_url": None,
        "claims": [
            {
                "dimension": "SKILL",
                "technology": "FastAPI",
                "has_implementation_detail": True,
                "context_narrative": "built services using fastapi",
                "metric_string": None,
                "repo_url": None,
                "source_location": "Pengalaman",
            },
            {
                "dimension": "SKILL",
                "technology": "Kubernetes",
                "has_implementation_detail": True,
                "context_narrative": "operated 40-node kubernetes cluster",
                "metric_string": "40 nodes",
                "repo_url": None,
                "source_location": "Pengalaman",
            },
        ],
        "career_timeline": [],
        "education": None,
        "anomalies": {},
    }

    schema = CandidateExtractionSchema.model_validate(payload)
    schema.apply_substring_guard(cv_text)

    fastapi_claim = next(c for c in schema.claims if c.technology == "FastAPI")
    k8s_claim = next(c for c in schema.claims if c.technology == "Kubernetes")

    assert fastapi_claim.has_implementation_detail is True
    assert fastapi_claim.context_narrative == "built services using fastapi"

    assert k8s_claim.has_implementation_detail is False
    assert k8s_claim.context_narrative is None, "unverified narrative must be dropped"
    assert k8s_claim.metric_string is None


def test_overlap_anomaly_explains_which_jobs_collided():
    """An anomaly row must name both roles/companies, not just echo a flag code."""
    timeline = [
        {
            "role": "Backend Engineer",
            "company": "PT Alpha",
            "is_relevant_role": True,
            "employment_type": "full_time",
            "start": "2022-01",
            "end": "2023-12",
        },
        {
            "role": "Freelance Developer",
            "company": "PT Beta",
            "is_relevant_role": True,
            "employment_type": "full_time",
            "start": "2022-03",
            "end": "2023-06",
        },
    ]

    risk, flags, details = DeterministicScoringEngine.evaluate_risk({}, timeline)

    assert risk == "HIGH"
    assert any(flag.startswith("CONCURRENT_FULLTIME_OVERLAP") for flag in flags)

    overlap = next(d for d in details if d["type"] == "CONCURRENT_FULLTIME_OVERLAP")
    assert overlap["severity"] == "HIGH"
    assert overlap["overlap_months"] == 15
    assert "PT Alpha" in overlap["description"]
    assert "PT Beta" in overlap["description"]
    assert "Backend Engineer" in overlap["description"]
    assert "Automated risk detection flag" not in overlap["description"]
    assert overlap["suggested_verification"]
    assert [r["company"] for r in overlap["roles"]] == ["PT Alpha", "PT Beta"]


def test_clean_timeline_reports_no_anomaly_details():
    risk, flags, details = DeterministicScoringEngine.evaluate_risk(
        {},
        [
            {
                "role": "Backend Engineer",
                "company": "PT Alpha",
                "is_relevant_role": True,
                "employment_type": "full_time",
                "start": "2020-01",
                "end": "2022-12",
            }
        ],
    )
    assert risk == "LOW"
    assert flags == []
    assert details == []
