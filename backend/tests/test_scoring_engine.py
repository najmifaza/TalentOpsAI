import os
import sys
import pytest

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.scoring import (
    DeterministicScoringEngine,
    calculate_relevance,
    is_tier3_metric_claim,
    merge_employment_intervals,
)

CORE_COMPETENCIES = ["FastAPI", "Docker", "PostgreSQL", "CI/CD", "Redis"]


def test_relevance_and_taxonomy_mapping():
    assert calculate_relevance("FastAPI", "FastAPI") == 1.0, "Exact match must be 1.0"
    assert calculate_relevance("Django", "FastAPI") == 0.7, "Ecosystem match must be 0.7"
    assert calculate_relevance("Figma", "FastAPI") == 0.0, "Irrelevant must be 0.0"


def test_tier3_metric_regex_and_fluff_guard():
    assert is_tier3_metric_claim("handled async requests", "reduced latency by 40%") is True
    assert is_tier3_metric_claim("handled 2500 rps throughput", None) is True
    # Fluff check: 100% without technical context keyword should fail Tier 3
    assert is_tier3_metric_claim("100% dedicated to client satisfaction", None) is False


def test_interval_merging_overlap_prevention():
    overlapping_timeline = [
        {"role": "Backend", "start": "2022-01", "end": "2023-06", "is_relevant_role": True},
        {"role": "Lead Architect", "start": "2022-06", "end": "2023-12", "is_relevant_role": True},
    ]
    # Total distinct period is 2022-01 to 2023-12 (24 months = 2.0 years), NOT 18 + 19 = 37 months
    merged_years = merge_employment_intervals(overlapping_timeline)
    assert 1.9 <= merged_years <= 2.1, f"Expected ~2.0 years, got {merged_years}"


def test_case_1_budi_santoso_strong_match():
    budi_claims = [
        {
            "dimension": "SKILL",
            "technology": "FastAPI",
            "has_implementation_detail": True,
            "context_narrative": "built async rest microservices using FastAPI handling 2500 rps",
            "metric_string": "handled 2500 rps throughput",
            "repo_url": "https://github.com/candidate/payment-service",
        },
        {
            "dimension": "SKILL",
            "technology": "PostgreSQL",
            "has_implementation_detail": True,
            "context_narrative": "reduced database query latency by 40% using composite indexing in PostgreSQL",
            "metric_string": "reduced latency by 40%",
        },
        {
            "dimension": "SKILL",
            "technology": "Redis",
            "has_implementation_detail": True,
            "context_narrative": "integrated redis caching layer to handle 2500 rps high throughput",
            "metric_string": "2500 rps load",
        },
        {
            "dimension": "SKILL",
            "technology": "CI/CD",
            "has_implementation_detail": True,
            "context_narrative": "maintained open-source repository with full CI/CD pipeline",
            "repo_url": "https://github.com/candidate/payment-service",
        },
        {
            "dimension": "SKILL",
            "technology": "Docker",
            "has_implementation_detail": True,
            "context_narrative": "containerized services with Docker for scalable microservices",
        },
    ]
    budi_timeline = [
        {"role": "Senior Backend", "start": "2019-01", "end": "2024-06", "is_relevant_role": True, "employment_type": "full_time"}
    ]
    budi_education = {"degree": "S1", "field_of_study": "Informatika"}
    budi_repos = {
        "https://github.com/candidate/payment-service": {
            "verified": True,
            "is_fork": False,
            "stars_count": 25,
        }
    }

    budi_res = DeterministicScoringEngine.compute_full_assessment(
        claims=budi_claims,
        career_timeline=budi_timeline,
        education=budi_education,
        anomalies={"prompt_injection_detected": False, "hidden_text_detected": False},
        core_competencies=CORE_COMPETENCIES,
        verified_repos=budi_repos,
    )

    assert budi_res["overall_score"] >= 85.0, f"Budi score should be >= 85.0, got {budi_res['overall_score']}"
    assert budi_res["confidence_level"] == "HIGH"
    assert budi_res["unresolved_risk"] == "LOW"
    assert budi_res["recommendation"] == "STRONG_MATCH"
    assert budi_res["triage_priority"] == "STANDARD"
    assert "Aturan 1" in budi_res["rule_applied"]


def test_case_2_reza_pratama_overlap_anomaly():
    reza_claims = [
        {
            "dimension": "SKILL",
            "technology": "FastAPI",
            "has_implementation_detail": True,
            "context_narrative": "designed distributed microservices with FastAPI serving 1000000 users",
            "metric_string": "1000000 active users",
        },
        {
            "dimension": "SKILL",
            "technology": "PostgreSQL",
            "has_implementation_detail": True,
            "context_narrative": "managed relational database schemas in PostgreSQL and MySQL",
        },
        {
            "dimension": "SKILL",
            "technology": "Docker",
            "has_implementation_detail": True,
            "context_narrative": "containerized services using Docker and orchestrated deployments",
        },
        {
            "dimension": "SKILL",
            "technology": "Redis",
            "has_implementation_detail": True,
            "context_narrative": "cached order states using Redis for high throughput processing",
        },
        {
            "dimension": "SKILL",
            "technology": "CI/CD",
            "has_implementation_detail": True,
            "context_narrative": "configured continuous integration workflows with GitHub Actions",
            "repo_url": "https://github.com/reza/order-service",
        },
    ]
    reza_timeline = [
        {"role": "Lead Architect", "start": "2020-01", "end": "2023-06", "employment_type": "full_time", "is_relevant_role": True},
        {"role": "Backend Specialist", "start": "2022-01", "end": "2024-05", "employment_type": "full_time", "is_relevant_role": True},
    ]
    reza_repos = {
        "https://github.com/reza/order-service": {
            "verified": True,
            "is_fork": False,
            "stars_count": 12,
        }
    }
    reza_res = DeterministicScoringEngine.compute_full_assessment(
        claims=reza_claims,
        career_timeline=reza_timeline,
        education={"degree": "S1", "field_of_study": "Informatika"},
        anomalies={"prompt_injection_detected": False, "hidden_text_detected": False},
        core_competencies=CORE_COMPETENCIES,
        verified_repos=reza_repos,
    )
    assert reza_res["unresolved_risk"] == "HIGH", "17 months overlap must trigger HIGH risk"
    assert reza_res["recommendation"] == "REVIEW_REQUIRED"
    assert reza_res["triage_priority"] == "HIGH_ATTENTION"
    assert "Aturan 2" in reza_res["rule_applied"]


def test_case_3_citra_lestari_weak_fit():
    citra_claims = [
        {"dimension": "SKILL", "technology": "Adobe Illustrator", "has_implementation_detail": True},
        {"dimension": "SKILL", "technology": "Photoshop", "has_implementation_detail": True},
    ]
    citra_timeline = [
        {"role": "Brand Designer", "start": "2021-01", "end": "2024-01", "is_relevant_role": False}
    ]
    citra_education = {"degree": "S1", "field_of_study": "Desain Komunikasi Visual"}

    citra_res = DeterministicScoringEngine.compute_full_assessment(
        claims=citra_claims,
        career_timeline=citra_timeline,
        education=citra_education,
        anomalies={},
        core_competencies=CORE_COMPETENCIES,
    )
    assert citra_res["overall_score"] < 60.0, f"Citra score should be < 60.0, got {citra_res['overall_score']}"
    assert citra_res["recommendation"] == "WEAK_FIT"
    assert "Aturan 4" in citra_res["rule_applied"]


def test_case_4_dewi_sartika_security_quarantine():
    budi_claims = [
        {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True},
        {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True},
    ]
    dewi_res = DeterministicScoringEngine.compute_full_assessment(
        claims=budi_claims,
        career_timeline=[{"role": "Developer", "start": "2020-01", "end": "present", "is_relevant_role": True}],
        education={"degree": "S1", "field_of_study": "Informatika"},
        anomalies={"prompt_injection_detected": True, "hidden_text_detected": True},
        core_competencies=CORE_COMPETENCIES,
    )
    assert dewi_res["unresolved_risk"] == "HIGH"
    assert dewi_res["recommendation"] == "REVIEW_REQUIRED"
    assert dewi_res["triage_priority"] == "HIGH_ATTENTION"
    assert "Aturan 0" in dewi_res["rule_applied"]


def test_case_5_eko_prasetyo_fairness_career_break():
    eko_claims = [
        {
            "dimension": "SKILL",
            "technology": "FastAPI",
            "has_implementation_detail": True,
            "context_narrative": "built async rest microservices using FastAPI handling 2500 rps",
            "metric_string": "handled 2500 rps throughput",
            "repo_url": "https://github.com/candidate/payment-service",
        },
        {
            "dimension": "SKILL",
            "technology": "PostgreSQL",
            "has_implementation_detail": True,
            "context_narrative": "reduced database query latency by 40% using composite indexing in PostgreSQL",
            "metric_string": "reduced latency by 40%",
        },
        {
            "dimension": "SKILL",
            "technology": "Redis",
            "has_implementation_detail": True,
            "context_narrative": "integrated redis caching layer to handle 2500 rps high throughput",
            "metric_string": "2500 rps load",
        },
        {
            "dimension": "SKILL",
            "technology": "CI/CD",
            "has_implementation_detail": True,
            "context_narrative": "maintained open-source repository with full CI/CD pipeline",
            "repo_url": "https://github.com/candidate/payment-service",
        },
        {
            "dimension": "SKILL",
            "technology": "Docker",
            "has_implementation_detail": True,
            "context_narrative": "containerized services with Docker for scalable microservices",
        },
    ]
    eko_timeline = [
        {"role": "Mid Backend", "start": "2023-03", "end": "present", "is_relevant_role": True},
        {"role": "Junior Backend", "start": "2018-03", "end": "2021-08", "is_relevant_role": True},
    ]
    eko_res = DeterministicScoringEngine.compute_full_assessment(
        claims=eko_claims,
        career_timeline=eko_timeline,
        education={"degree": "S1", "field_of_study": "Informatika"},
        anomalies={"career_break_detected": True},
        core_competencies=CORE_COMPETENCIES,
        verified_repos={"https://github.com/candidate/payment-service": {"verified": True, "is_fork": False}},
    )
    # Career break must NOT automatically trigger MEDIUM or HIGH risk
    assert eko_res["unresolved_risk"] == "LOW", "Legitimate career break must not be penalized"
    assert "CAREER_BREAK_FLAG" in eko_res["anomaly_flags"]
    assert eko_res["recommendation"] == "STRONG_MATCH"
