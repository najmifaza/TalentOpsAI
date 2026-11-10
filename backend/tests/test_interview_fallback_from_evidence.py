"""Fallback pertanyaan wawancara dari bukti kandidat.

Kasus produksi `#TK-DA7D88`: SKILL 100 (tidak ada celah kompetensi) dan gateway model
mengembalikan 403, jadi template celah menghasilkan nol pertanyaan dan tab Simulasi
Wawancara kosong. Jalur ini harus selalu menghasilkan pertanyaan.
"""
from app.core.interview_generator import VALID_DIFFICULTY, build_evidence_questions


CLAIM_L3 = {
    "technology": "FastAPI",
    "has_implementation_detail": True,
    "metric_string": "320 ms",
    "context_narrative": "Merancang ulang API pembayaran dengan FastAPI sehingga waktu respons turun dari 320 ms menjadi 90 ms.",
}
CLAIM_L2 = {
    "technology": "PostgreSQL",
    "has_implementation_detail": True,
    "metric_string": None,
    "context_narrative": "Melakukan partisi tabel transaksi dan indeks komposit pada PostgreSQL.",
}
CLAIM_L1 = {
    "technology": "Redis",
    "has_implementation_detail": False,
    "metric_string": None,
    "context_narrative": "Memakai Redis untuk cache katalog produk.",
}


def test_strong_candidate_still_gets_questions():
    """Tanpa klaim bercelah, kandidat skor penuh tetap harus punya pertanyaan."""
    questions = build_evidence_questions([CLAIM_L1], [], ["Redis"])

    assert len(questions) == 1
    assert questions[0]["target_skill"] == "Redis"
    assert questions[0]["scenario_question"]
    assert "Redis" in questions[0]["scenario_question"]


def test_difficulty_follows_evidence_strength():
    questions = build_evidence_questions([CLAIM_L1, CLAIM_L2, CLAIM_L3], [], [])
    by_skill = {q["target_skill"]: q for q in questions}

    assert by_skill["FastAPI"]["difficulty_level"] == "L3_EDGE_CASE"
    assert by_skill["PostgreSQL"]["difficulty_level"] == "L2_SYSTEM_DESIGN"
    assert by_skill["Redis"]["difficulty_level"] == "L1_FUNDAMENTAL"
    assert all(q["difficulty_level"] in VALID_DIFFICULTY for q in questions)


def test_evidence_score_decides_order_and_count_is_capped():
    evidence = [{"target_competency": "Redis", "score_contribution": 100.0}]
    questions = build_evidence_questions([CLAIM_L3, CLAIM_L2, CLAIM_L1], evidence, [], max_questions=2)

    assert len(questions) == 2
    assert questions[0]["target_skill"] == "Redis"


def test_long_quote_is_trimmed_and_empty_claims_are_safe():
    long_claim = dict(CLAIM_L3, context_narrative="x" * 500)
    questions = build_evidence_questions([long_claim], [], [])

    assert len(questions) == 1
    assert len(questions[0]["scenario_question"]) < 1500
    assert build_evidence_questions([], [], []) == []


def test_claims_without_context_are_skipped():
    questions = build_evidence_questions([{"technology": "Docker", "context_narrative": ""}], [], [])

    assert questions == []
