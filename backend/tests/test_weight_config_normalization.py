"""
Bobot 4D per lowongan harus benar-benar dipakai (dokumen: tingkat prioritas 1).

Baris produksi memakai key gaya lama (`w_skill/w_exp/w_edu/w_port`) sementara mesin skor
mencari `SKILL/EXPERIENCE/EDUCATION/PORTFOLIO`. Tanpa normalisasi, keempat nilai jatuh ke
0.0, total bobot 0, dan skor diam-diam memakai DEFAULT_WEIGHTS — bobot per lowongan terlihat
terkonfigurasi padahal tidak berpengaruh.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.scoring import DeterministicScoringEngine, normalize_weight_config

CLAIMS = [
    {
        "dimension": "SKILL",
        "technology": "Python",
        "has_implementation_detail": True,
        "context_narrative": "Membangun layanan Python menurunkan latency 40%",
        "metric_string": "40%",
    }
]
TIMELINE = [
    {
        "role": "Backend Engineer",
        "company": "PT A",
        "is_relevant_role": True,
        "employment_type": "full_time",
        "start": "2019-01",
        "end": "2024-01",
    }
]
EDUCATION = {"degree": "S1", "field_of_study": "Informatika", "graduation_status": "Lulus"}


def _score(weights):
    return DeterministicScoringEngine.compute_full_assessment(
        claims=CLAIMS,
        career_timeline=TIMELINE,
        education=EDUCATION,
        anomalies={},
        core_competencies=["Python"],
        verified_repos={},
        weights=weights,
        is_programmer_role=True,
    )


def test_legacy_and_canonical_keys_normalise_to_the_same_mapping():
    legacy = normalize_weight_config({"w_skill": 0.45, "w_exp": 0.35, "w_edu": 0.1, "w_port": 0.1})
    canonical = normalize_weight_config(
        {"SKILL": 0.45, "EXPERIENCE": 0.35, "EDUCATION": 0.1, "PORTFOLIO": 0.1}
    )
    assert legacy == canonical == {"SKILL": 0.45, "EXPERIENCE": 0.35, "EDUCATION": 0.1, "PORTFOLIO": 0.1}


def test_lowercase_and_unknown_keys():
    assert normalize_weight_config({"skill": 0.5}) == {"SKILL": 0.5}
    assert normalize_weight_config({"bobot_ajaib": 0.9}) is None
    assert normalize_weight_config(None) is None
    assert normalize_weight_config("SKILL=0.4") is None
    assert normalize_weight_config({"SKILL": "bukan angka"}) is None


def test_legacy_weights_actually_change_the_score():
    """The regression this file exists for: legacy weights used to be silently ignored."""
    with_legacy = _score({"w_skill": 0.45, "w_exp": 0.35, "w_edu": 0.1, "w_port": 0.1})
    with_default = _score(None)
    with_canonical = _score(
        {"SKILL": 0.45, "EXPERIENCE": 0.35, "EDUCATION": 0.1, "PORTFOLIO": 0.1}
    )

    assert with_legacy["overall_score"] != with_default["overall_score"]
    assert with_legacy["overall_score"] == with_canonical["overall_score"]


def test_weights_applied_is_reported_for_the_narration():
    result = _score({"w_skill": 0.45, "w_exp": 0.35, "w_edu": 0.1, "w_port": 0.1})
    assert result["weights_applied"]["SKILL"] == pytest.approx(0.45)
    assert sum(result["weights_applied"].values()) == pytest.approx(1.0)


def test_empty_config_falls_back_to_defaults_deliberately():
    result = _score({})
    assert result["weights_applied"] == DeterministicScoringEngine.DEFAULT_WEIGHTS
