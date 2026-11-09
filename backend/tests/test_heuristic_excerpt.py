"""
Jalur heuristik tidak boleh memakai seluruh CV sebagai "kutipan" (kasus #TK-7588D4).

PDF hasil ekspor tertentu tidak menyimpan pemisah baris, sehingga pencarian "baris" berakhir
mengambil seluruh naskah (3.185 karakter) sebagai narasi tiap klaim. Sebelum ada batas
panjang, itu lolos substring guard sebagai kutipan "terverifikasi"; sesudah ada batas, semua
klaim turun ke Tier 1 dan skor anjlok (44). Keduanya salah — akarnya ada di pengambilan
potongan teks, bukan di verifikatornya.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.triage_service import (
    HEURISTIC_EXCERPT_CHARS,
    _excerpt_around,
    _extract_heuristic_fallback,
)

# Satu baris panjang, tanpa "\n" sama sekali — bentuk yang memicu bug.
SINGLE_LINE_CV = (
    "[NAME_REDACTED] Senior Backend Engineer Jakarta Selatan [EMAIL_REDACTED] "
    "RINGKASAN PROFIL Backend engineer dengan pengalaman 6 tahun membangun layanan pembayaran. "
    "KEAHLIAN Python, FastAPI, PostgreSQL, Docker, Redis. "
    "PENGALAMAN KERJA Januari 2021 sampai Desember 2023 sebagai Senior Backend Engineer. "
    "Merancang ulang API pembayaran dengan FastAPI sehingga waktu respons turun dari 320 ms menjadi 90 ms. "
    "Mengoptimalkan PostgreSQL dengan partisi tabel transaksi dan indeks komposit. "
    "PENDIDIKAN S1 Informatika lulus 2017."
)

MULTILINE_CV = "\n".join(
    [
        "RINGKASAN PROFIL Backend engineer.",
        "KEAHLIAN Python, FastAPI, PostgreSQL.",
        "Merancang ulang API pembayaran dengan FastAPI sehingga waktu respons turun menjadi 90 ms.",
        "Mengelola PostgreSQL berisi 20 tabel transaksi harian.",
    ]
)

CORE = ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"]


def test_excerpt_stays_inside_the_character_ceiling():
    start = SINGLE_LINE_CV.index("FastAPI")
    excerpt = _excerpt_around(SINGLE_LINE_CV, start, start + len("FastAPI"))

    assert 0 < len(excerpt) <= HEURISTIC_EXCERPT_CHARS
    assert "FastAPI" in excerpt
    assert excerpt in SINGLE_LINE_CV


def test_single_line_cv_gets_one_excerpt_not_the_document():
    schema = _extract_heuristic_fallback(
        sanitized_text=SINGLE_LINE_CV,
        core_competencies=CORE,
        job_title="Senior Backend Engineer",
        is_tech_role=True,
    )
    assert schema.claims, "expected competencies to be detected"

    for claim in schema.claims:
        narrative = claim.context_narrative or ""
        assert len(narrative) <= HEURISTIC_EXCERPT_CHARS
        assert len(narrative) < len(SINGLE_LINE_CV)
        assert narrative in SINGLE_LINE_CV


def test_excerpts_survive_the_substring_guard():
    schema = _extract_heuristic_fallback(
        sanitized_text=SINGLE_LINE_CV,
        core_competencies=CORE,
        job_title="Senior Backend Engineer",
        is_tech_role=True,
    )
    schema.apply_substring_guard(SINGLE_LINE_CV)

    verified = [c for c in schema.claims if c.has_implementation_detail]
    assert verified, "heuristic quotes must still verify, otherwise the fallback is useless"
    assert not any("oversized quote" in note for note in schema.anomalies.notes)


def test_multiline_cv_still_uses_the_line_as_quote():
    schema = _extract_heuristic_fallback(
        sanitized_text=MULTILINE_CV,
        core_competencies=["FastAPI", "PostgreSQL"],
        job_title="Backend Engineer",
        is_tech_role=True,
    )
    quotes = {c.technology: c.context_narrative for c in schema.claims}
    # The heuristic keeps the first line where the term appears, so FastAPI resolves to the
    # skills line; PostgreSQL's first hit is the bullet (the alias "PostgreSQL." with a
    # trailing period is rejected by the word-boundary regex).
    assert quotes.get("FastAPI") == "KEAHLIAN Python, FastAPI, PostgreSQL."
    assert "20 tabel" in (quotes.get("PostgreSQL") or "")