import os
import sys
import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas.extraction import (
    CandidateExtractionSchema,
    ClaimItem,
    EducationItem,
    CareerTimelineItem,
)


def test_valid_extraction_payload():
    raw_payload = {
        "claims": [
            {
                "dimension": "SKILL",
                "technology": "FastAPI",
                "has_implementation_detail": True,
                "context_narrative": "built async rest microservices handling 2k rps",
                "metric_string": "reduced latency by 40%",
                "repo_url": "https://github.com/candidate/payment-service",
                "source_location": "CV Page 2",
            }
        ],
        "career_timeline": [
            {
                "role": "Backend Engineer",
                "company": "[COMPANY_A]",
                "is_relevant_role": True,
                "employment_type": "full_time",
                "start": "2022-05",
                "end": "2024-06",
            }
        ],
        "education": {
            "degree": "S1",
            "field_of_study": "Informatika",
            "graduation_status": "Lulus",
        },
    }

    schema = CandidateExtractionSchema.model_validate(raw_payload)
    assert len(schema.claims) == 1
    assert schema.claims[0].technology == "FastAPI"
    assert schema.education.degree == "S1"


def test_strict_anti_bias_forbids_university():
    biased_payload = {
        "degree": "S1",
        "field_of_study": "Informatika",
        "graduation_status": "Lulus",
        "university": "Universitas Top Tier",  # FORBIDDEN
    }
    with pytest.raises(ValidationError):
        EducationItem.model_validate(biased_payload)


def test_substring_guard_validation_and_downgrade():
    cv_text = "Experienced developer who built async rest microservices handling 2k rps with python."

    # 1. Authentic claim retained
    valid_payload = {
        "claims": [
            {
                "dimension": "SKILL",
                "technology": "FastAPI",
                "has_implementation_detail": True,
                "context_narrative": "built async rest microservices handling 2k rps",
            }
        ]
    }
    schema = CandidateExtractionSchema.model_validate(valid_payload)
    schema.apply_substring_guard(cv_text)
    assert schema.claims[0].has_implementation_detail is True

    # 2. Hallucinated claim downgraded
    fake_payload = {
        "claims": [
            {
                "dimension": "SKILL",
                "technology": "Docker",
                "has_implementation_detail": True,
                "context_narrative": "configured multi-stage k8s clusters on aws",
            }
        ]
    }
    fake_schema = CandidateExtractionSchema.model_validate(fake_payload)
    fake_schema.apply_substring_guard(cv_text)
    assert fake_schema.claims[0].has_implementation_detail is False
