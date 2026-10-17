import os
import sys
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas.extraction import (
    CandidateExtractionSchema,
    ClaimItem,
    EducationItem,
    CareerTimelineItem,
)


def run_checks():
    # 1. Valid extraction payload
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

    # 2. Strict Anti-Bias: forbidding university / accreditation
    biased_payload = {
        "degree": "S1",
        "field_of_study": "Informatika",
        "graduation_status": "Lulus",
        "university": "Universitas Top Tier",  # FORBIDDEN
    }
    bias_caught = False
    try:
        EducationItem.model_validate(biased_payload)
    except ValidationError:
        bias_caught = True
    assert bias_caught, "Schema MUST reject unallowed university/campus fields"

    # 3. Substring Guard check
    cv_text = "Experienced developer who built async rest microservices handling 2k rps with python."
    schema.apply_substring_guard(cv_text)
    assert schema.claims[0].has_implementation_detail is True, "Authentic narrative must retain True"

    # 4. Substring Guard hallucination downgrade
    hallucinated_payload = {
        "claims": [
            {
                "dimension": "SKILL",
                "technology": "Docker",
                "has_implementation_detail": True,
                "context_narrative": "configured multi-stage k8s clusters on aws",
            }
        ]
    }
    fake_schema = CandidateExtractionSchema.model_validate(hallucinated_payload)
    fake_schema.apply_substring_guard(cv_text)
    assert fake_schema.claims[0].has_implementation_detail is False, "Hallucinated claim must be downgraded to False"

    print("ALL CHECKS PASSED: Pydantic v2 Extraction Schema & Anti-Bias verified.")


if __name__ == "__main__":
    run_checks()
