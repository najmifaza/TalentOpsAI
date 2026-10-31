"""
Public career-portal payload guards.

Two rules that are easy to break silently and expensive when broken:

1. `GET /careers/track/{token}` must never grow a CV quote. The candidate dossier
   legitimately shows `claim_text`; this endpoint is unauthenticated and the only
   thing standing between a leaked token and a stranger is what the payload omits.
2. `bias_audit` is `None` until someone runs analyze-bias. A job that was never
   audited must not advertise a perfect inclusivity score.

The row mapper is exercised directly so the assertions do not need a database.
"""
import json
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.api.careers import _job_public_row
from app.core.scoring import inclusivity_from_findings

PUBLIC_KEYS = {
    "id", "title", "department", "raw_text", "core_competencies", "status", "created_at",
    "company_name", "company_logo_url", "company_industry", "job_function",
    "employment_level", "location", "deadline", "description_text", "requirements_text",
    "company_about", "company_address", "company_website", "bias_audit",
    "is_tech_role", "competency_taxonomies",
}


class FakeRow(dict):
    """Stands in for a SQLAlchemy RowMapping, which exposes `keys()`."""

    def keys(self):
        return list(super().keys())


def make_row(**overrides):
    row = {
        "id": 1,
        "title": "Senior Backend Engineer",
        "department": "Core Engineering",
        "raw_text": "Kami mencari Senior Backend Engineer.",
        "core_competencies": json.dumps(["FastAPI", "Docker"]),
        "flagged_ambiguities": None,
        "status": "active",
        "created_at": None,
        "company_name": "TalentOps AI",
        "company_logo_url": None,
        "company_industry": "Teknologi Informasi",
        "job_function": "Engineering",
        "employment_level": "Profesional",
        "location": "Jakarta Selatan (Hibrida)",
        "deadline": None,
        "description_text": "Merancang layanan backend.",
        "requirements_text": "S1 Informatika.",
        "company_about": "Ekosistem seleksi kerja berbasis agen AI.",
        "company_address": "Purwokerto",
        "company_website": "https://talentops.ai.id",
    }
    row.update(overrides)
    return FakeRow(row)


def test_public_row_exposes_exactly_the_agreed_fields():
    assert set(_job_public_row(make_row())) == PUBLIC_KEYS


def test_public_row_keeps_raw_text_for_the_apply_flow():
    assert _job_public_row(make_row())["raw_text"]


def test_core_competencies_are_decoded():
    assert _job_public_row(make_row())["core_competencies"] == ["FastAPI", "Docker"]


def test_bias_audit_is_none_before_any_audit():
    assert _job_public_row(make_row())["bias_audit"] is None


def test_bias_audit_reports_a_clean_audit_as_scored():
    # "[]" means analyze-bias ran and found nothing; None means it never ran.
    audit = _job_public_row(make_row(flagged_ambiguities=json.dumps([])))["bias_audit"]
    assert audit["inclusivity_score"] == 100
    assert audit["total_flags"] == 0


def test_bias_audit_counts_flags_and_categories():
    findings = [
        {"category": "GENDER_EXCLUSIVE_TERMS", "severity": "HIGH"},
        {"category": "AMBIGUOUS_WORK_EXPECTATIONS", "severity": "LOW"},
    ]
    audit = _job_public_row(make_row(flagged_ambiguities=json.dumps(findings)))["bias_audit"]
    assert audit["inclusivity_score"] == 81
    assert audit["inclusivity_rating"] == "GOOD"
    assert audit["total_flags"] == 2
    assert audit["categories"] == ["AMBIGUOUS_WORK_EXPECTATIONS", "GENDER_EXCLUSIVE_TERMS"]


@pytest.mark.parametrize(
    "findings,expected",
    [
        ([], (100, "EXCELLENT")),
        ([{"severity": "LOW"}], (96, "EXCELLENT")),
        ([{"severity": "MEDIUM"}], (92, "EXCELLENT")),
        ([{"severity": "HIGH"}], (85, "GOOD")),
        ([{"severity": "HIGH"}] * 3, (55, "NEEDS_REVISION")),
        ([{"severity": "HIGH"}] * 10, (0, "NEEDS_REVISION")),
    ],
)
def test_inclusivity_penalty_table(findings, expected):
    assert inclusivity_from_findings(findings) == expected
