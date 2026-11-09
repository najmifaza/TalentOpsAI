"""
Dua detektor baru (dokumen: tingkat prioritas 1 butir 4 & 2 butir 7).

1. Title inflation sebelumnya hanya mengenali kosakata Inggris, sehingga pola yang paling
   sering muncul di CV Indonesia ("Staf" -> "Manajer") lolos tanpa catatan.
2. Klaim pengalaman ("8 tahun pengalaman") tidak pernah dibandingkan dengan rentang tanggal
   yang benar-benar terbaca, padahal itu salah satu bentuk inflasi CV paling umum.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.scoring import (
    DeterministicScoringEngine,
    claimed_experience_years,
    detect_experience_claim_inflation,
)


def _risk(timeline, anomalies=None):
    return DeterministicScoringEngine.evaluate_risk(anomalies or {}, timeline)


def _role(title, start, end, employment_type="full_time"):
    return {
        "role": title,
        "company": "PT Contoh",
        "is_relevant_role": True,
        "employment_type": employment_type,
        "start": start,
        "end": end,
    }


def test_indonesian_staff_to_manager_jump_is_flagged():
    risk, flags, details = _risk([_role("Staf Administrasi", "2023-01", "2023-06"),
                                  _role("Manajer Operasional", "2023-04", "2025-01")])
    assert "TITLE_INFLATION_DETECTED" in flags
    assert risk == "MEDIUM"
    assert any(d["type"] == "TITLE_INFLATION_DETECTED" for d in details)


def test_kepala_and_koordinator_are_recognised_as_leads():
    _, flags, _ = _risk([_role("Magang Pemasaran", "2024-01", "2024-03"),
                         _role("Kepala Cabang", "2024-05", "2025-01")])
    assert "TITLE_INFLATION_DETECTED" in flags


def test_normal_progression_is_not_flagged():
    risk, flags, _ = _risk([_role("Junior Engineer", "2019-01", "2021-01"),
                            _role("Senior Engineer", "2022-01", "2024-01")])
    assert "TITLE_INFLATION_DETECTED" not in flags
    assert risk == "LOW"


def test_claimed_years_reads_indonesian_and_english_phrases():
    assert claimed_experience_years("Pengalaman kerja minimal 8 tahun di bidang backend") == 8
    assert claimed_experience_years("Saya memiliki 6 tahun pengalaman profesional.") == 6
    assert claimed_experience_years("7+ years of experience in distributed systems") == 7
    assert claimed_experience_years("Fresh graduate, aktif di organisasi kampus") is None


def test_claim_far_above_timeline_is_flagged():
    anomaly = detect_experience_claim_inflation("Pengalaman 8 tahun sebagai backend engineer.", 1.33)
    assert anomaly is not None
    assert anomaly["type"] == "EXPERIENCE_CLAIM_INFLATION"
    assert anomaly["severity"] == "MEDIUM"
    assert anomaly["claimed_years"] == 8
    assert anomaly["timeline_years"] == 1.33


def test_claim_within_tolerance_is_left_alone():
    # 6 tahun diklaim, 5 tahun terbaca: dalam batas toleransi pembulatan ringkasan CV.
    assert detect_experience_claim_inflation("6 tahun pengalaman.", 5.0) is None


def test_unparseable_timeline_stays_silent():
    """A detector that fires on bad parsing is worse than no detector."""
    assert detect_experience_claim_inflation("10 tahun pengalaman.", None) is None
    assert detect_experience_claim_inflation("Tanpa angka sama sekali.", 0.0) is None


def test_absurd_number_is_ignored():
    assert claimed_experience_years("99 tahun pengalaman") is None
