import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.scoring import DeterministicScoringEngine
from app.schemas.extraction import CandidateExtractionSchema, EducationItem


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
    # Inclusive count: 2022-03..2023-06 covers 16 calendar months.
    assert overlap["overlap_months"] == 16
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


def _role(company, start, end, employment_type="full_time"):
    return {
        "role": "Engineer",
        "company": company,
        "is_relevant_role": True,
        "employment_type": employment_type,
        "start": start,
        "end": end,
    }


def test_overlap_threshold_is_more_than_three_months():
    """A 3-month overlap is tolerated; 4 months is not. Guards the inclusive count."""
    three = DeterministicScoringEngine.evaluate_risk(
        {}, [_role("PT A", "2023-01", "2023-12"), _role("PT B", "2023-05", "2023-07")]
    )
    assert three[0] == "LOW", "exactly 3 months of overlap must not raise risk"
    assert three[2] == []

    four = DeterministicScoringEngine.evaluate_risk(
        {}, [_role("PT A", "2023-01", "2023-12"), _role("PT B", "2023-05", "2023-08")]
    )
    assert four[0] == "HIGH"
    assert four[2][0]["overlap_months"] == 4


def test_full_year_overlap_counts_twelve_months():
    """2024-01..2025-12 is 24 months inclusive, not 23."""
    risk, flags, details = DeterministicScoringEngine.evaluate_risk(
        {}, [_role("Pondok Modern Tazakka", "2024-01", "2025-12"), _role("PT Media", "2024-01", "2025-12")]
    )
    assert risk == "HIGH"
    assert details[0]["overlap_months"] == 24
    assert "CONCURRENT_FULLTIME_OVERLAP_24_MONTHS" in flags


def test_unknown_employment_type_does_not_break_extraction():
    """A stray label used to fail the whole schema and drop the candidate to fallback."""
    payload = {
        "github_url": None,
        "portfolio_url": None,
        "claims": [],
        "career_timeline": [
            {"role": "Engineer", "company": "PT A", "is_relevant_role": True,
             "employment_type": "full_time", "start": "2020-01", "end": "2021-01"},
            {"role": "Jeda", "company": "-", "is_relevant_role": True,
             "employment_type": "career_break", "start": "2021-02", "end": "2022-01"},
            {"role": "Engineer", "company": "PT B", "is_relevant_role": True,
             "employment_type": "full-time", "start": "2022-02", "end": "2023-01"},
        ],
        "education": None,
        "anomalies": {},
    }

    schema = CandidateExtractionSchema.model_validate(payload)

    assert schema.career_timeline[1].employment_type == "contract"
    assert schema.career_timeline[2].employment_type == "full_time"


def test_unknown_employment_type_does_not_create_false_overlap():
    """Parking an unknown label as full_time would invent a concurrency alarm."""
    timeline = [
        {"role": "Engineer", "company": "PT A", "is_relevant_role": True,
         "employment_type": "full_time", "start": "2022-01", "end": "2023-12"},
        {"role": "Jeda", "company": "-", "is_relevant_role": True,
         "employment_type": "career_break", "start": "2022-01", "end": "2023-12"},
    ]
    risk, flags, details = DeterministicScoringEngine.evaluate_risk({}, timeline)
    assert risk == "LOW"
    assert flags == []
    assert details == []


def test_exact_duplicate_technologies_collapse():
    """'Next.js' and 'nextjs' are one skill in the dossier, not two nodes."""
    claims = [
        {"dimension": "SKILL", "technology": "Next.js", "has_implementation_detail": True,
         "context_narrative": "built portal with next.js", "metric_string": None,
         "repo_url": None, "source_location": "Proyek"},
        {"dimension": "SKILL", "technology": "nextjs", "has_implementation_detail": False,
         "context_narrative": None, "metric_string": None, "repo_url": None,
         "source_location": "Skills"},
    ]

    score, records = DeterministicScoringEngine.calculate_skill_score(
        claims=claims, core_competencies=["React"], verified_github_repos={}
    )

    names = [r["target_competency"] for r in records]
    assert len(names) == len(set(n.lower().replace(".", "") for n in names))
    assert sum(1 for n in names if n.lower().replace(".", "") == "nextjs") == 1
    # The surviving row is the verified, better-scoring one.
    survivor = next(r for r in records if r["target_competency"].lower().replace(".", "") == "nextjs")
    assert survivor["verified"] is True
    assert survivor["matched_requirement"] == "React"


def test_distinct_but_related_technologies_are_kept():
    """SQL and MySQL/PostgreSQL are different names, so both stay as separate nodes."""
    claims = [
        {"dimension": "SKILL", "technology": "SQL", "has_implementation_detail": True,
         "context_narrative": "membimbing praktikum skema relasional", "metric_string": None,
         "repo_url": None, "source_location": "Pengalaman"},
        {"dimension": "SKILL", "technology": "MySQL/PostgreSQL", "has_implementation_detail": True,
         "context_narrative": "troubleshooting database engine", "metric_string": None,
         "repo_url": None, "source_location": "Pengalaman"},
    ]

    _score, records = DeterministicScoringEngine.calculate_skill_score(
        claims=claims, core_competencies=["PostgreSQL", "MariaDB"], verified_github_repos={}
    )

    by_tech = {r["target_competency"]: r for r in records}
    assert by_tech["SQL"]["matched_requirement"] == "MariaDB"
    assert by_tech["MySQL/PostgreSQL"]["matched_requirement"] == "PostgreSQL"
    assert by_tech["MySQL/PostgreSQL"]["score_contribution"] == 60.0


def test_one_technology_covering_two_requirements_is_one_node():
    """A CV listing only PostgreSQL for two DB requirements must not render twice."""
    claims = [
        {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True,
         "context_narrative": "tuned postgresql queries", "metric_string": None,
         "repo_url": None, "source_location": "Pengalaman"},
    ]

    _score, records = DeterministicScoringEngine.calculate_skill_score(
        claims=claims, core_competencies=["PostgreSQL", "MariaDB"], verified_github_repos={}
    )

    postgres_rows = [r for r in records if r["target_competency"] == "PostgreSQL"]
    assert len(postgres_rows) == 1, "same technology must collapse to one node"
    assert postgres_rows[0]["score_contribution"] == 60.0
    # Both requirements it covered survive in the badge.
    assert "PostgreSQL" in postgres_rows[0]["matched_requirement"]
    assert "MariaDB" in postgres_rows[0]["matched_requirement"]


def test_null_company_in_career_gap_entry_does_not_break_extraction():
    """A career-gap row carries company: null; that must not fail the whole schema."""
    payload = {
        "github_url": None,
        "portfolio_url": None,
        "claims": [],
        "career_timeline": [
            {"role": "Backend Engineer", "company": "PT A", "is_relevant_role": True,
             "employment_type": "full_time", "start": "2020-01", "end": "2021-12"},
            {"role": None, "company": None, "is_relevant_role": True,
             "employment_type": "career_break", "start": "2022-01", "end": "2023-06"},
        ],
        "education": None,
        "anomalies": {},
    }

    schema = CandidateExtractionSchema.model_validate(payload)

    gap = schema.career_timeline[1]
    assert gap.company == "-"
    assert gap.role == "-"
    assert gap.employment_type == "contract"
    assert gap.start == "2022-01"


def test_unknown_enum_labels_never_sink_the_extraction():
    """
    Guard for the whole class of bug: every Literal field on the schema accepts
    model-emitted variants. One stray label used to drop the candidate to heuristic
    fallback with zero evidence.
    """
    payload = {
        "github_url": None,
        "portfolio_url": None,
        "claims": [
            {"dimension": "keahlian", "technology": "Next.js",
             "has_implementation_detail": False},
        ],
        "career_timeline": [
            {"role": "Engineer", "company": "PT A", "employment_type": "Career Break",
             "start": "2024-01", "end": "2024-06"},
        ],
        "education": {
            "degree": "S1",
            "field_of_study": "Informatika",
            "graduation_status": "Sedang Menempuh Pendidikan",
        },
        "anomalies": {},
    }

    schema = CandidateExtractionSchema.model_validate(payload)

    assert schema.claims[0].dimension == "SKILL"
    assert schema.career_timeline[0].employment_type == "contract"
    assert schema.education.graduation_status == "Sedang Menempuh"


def test_graduation_status_variants_map_correctly():
    cases = {
        "Lulus": "Lulus",
        "lulus": "Lulus",
        "Graduated": "Lulus",
        "Belum Lulus": "Belum Lulus",
        "belum selesai": "Belum Lulus",
        "Sedang Menempuh Pendidikan": "Sedang Menempuh",
        "masih menempuh": "Sedang Menempuh",
        "ongoing": "Sedang Menempuh",
        "tidak diketahui": "Lulus",  # fallback, never a validation error
    }
    for raw, expected in cases.items():
        item = EducationItem.model_validate({"graduation_status": raw})
        assert item.graduation_status == expected, raw


def test_null_dates_do_not_create_false_overlap():
    """A timeline row with no start date must be ignored, not anchored to today."""
    timeline = [
        {"role": "Engineer", "company": "PT A", "is_relevant_role": True,
         "employment_type": "full_time", "start": "2022-01", "end": "2023-12"},
        {"role": "-", "company": "-", "is_relevant_role": True,
         "employment_type": "full_time", "start": "", "end": ""},
    ]
    risk, flags, details = DeterministicScoringEngine.evaluate_risk({}, timeline)
    assert risk == "LOW"
    assert flags == []
    assert details == []
