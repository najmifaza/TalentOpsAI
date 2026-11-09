"""
Batas panjang kutipan bukti (regresi kasus #TK-B3475B).

Substring guard lama hanya memeriksa apakah narasi "ada di dalam CV". Seluruh CV tentu ada di
dalam dirinya sendiri, sehingga narasi sepanjang 5.056 karakter lolos sebagai "kutipan
terverifikasi" dan Evidence Graph menampilkan seluruh isi resume sebagai satu kutipan. Setiap
klaim jadi terlihat didukung bukti padahal tidak ada kutipan sungguhan.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.scoring import DeterministicScoringEngine, _as_excerpt
from app.schemas.extraction import (
    MAX_METRIC_CHARS,
    MAX_QUOTE_CHARS,
    CandidateExtractionSchema,
)

CV_TEXT = (
    "Bagas Prasetyo Nugroho\n"
    "Telepon: [PHONE_REDACTED] Email: [EMAIL_REDACTED]\n"
    "RINGKASAN PROFIL Backend engineer dengan pengalaman 6 tahun membangun layanan pembayaran.\n"
    "KEAHLIAN Python, FastAPI, PostgreSQL, Docker, Kubernetes, Redis, CI/CD, GitHub Actions.\n"
    "PENGALAMAN KERJA Senior Backend Engineer | PT Nusantara Digital, Januari 2021 - Desember 2023.\n"
    "Merancang ulang API pembayaran dengan FastAPI sehingga waktu respons turun dari 320 ms menjadi 90 ms.\n"
    "Mengoptimalkan PostgreSQL dengan partisi tabel transaksi dan indeks komposit.\n"
    "PENDIDIKAN S1 Informatika, Universitas Jenderal Soedirman, lulus 2017.\n"
)


def _schema(narrative, technology="FastAPI", metric=None):
    return CandidateExtractionSchema.model_validate(
        {
            "claims": [
                {
                    "dimension": "SKILL",
                    "technology": technology,
                    "has_implementation_detail": True,
                    "context_narrative": narrative,
                    "metric_string": metric,
                }
            ]
        }
    )


def test_whole_resume_as_narrative_is_rejected():
    schema = _schema(CV_TEXT)
    schema.apply_substring_guard(CV_TEXT)

    claim = schema.claims[0]
    assert claim.has_implementation_detail is False
    assert claim.context_narrative is None
    assert any("oversized quote" in note for note in schema.anomalies.notes)


def test_real_sentence_stays_verified():
    quote = (
        "Merancang ulang API pembayaran dengan FastAPI sehingga waktu respons turun "
        "dari 320 ms menjadi 90 ms"
    )
    schema = _schema(quote, metric="320 ms menjadi 90 ms")
    schema.apply_substring_guard(CV_TEXT)

    claim = schema.claims[0]
    assert claim.has_implementation_detail is True
    assert claim.context_narrative == quote


def test_multi_sentence_quote_over_the_word_ceiling_is_rejected():
    long_quote = " ".join(["FastAPI"] + ["kata"] * 60)
    schema = _schema(long_quote)
    schema.apply_substring_guard(CV_TEXT + " " + long_quote)
    assert schema.claims[0].has_implementation_detail is False


def test_exactly_at_the_character_ceiling_is_allowed():
    base = "PostgreSQL "
    quote = (base * (MAX_QUOTE_CHARS // len(base) + 1))[:MAX_QUOTE_CHARS]
    schema = _schema(quote)
    schema.apply_substring_guard(f"{CV_TEXT}\n{quote}\n")
    assert schema.claims[0].has_implementation_detail is True


def test_oversized_metric_is_truncated():
    schema = _schema(
        "Merancang ulang API pembayaran dengan FastAPI",
        metric="X" * (MAX_METRIC_CHARS + 40),
    )
    schema.apply_substring_guard(CV_TEXT)
    assert len(schema.claims[0].metric_string) == MAX_METRIC_CHARS


def test_scoring_never_persists_more_than_one_excerpt():
    """Even if a long narrative slips through another path, stored evidence stays bounded."""
    long_narrative = " ".join(CV_TEXT.split())
    _score, evidence = DeterministicScoringEngine.calculate_skill_score(
        claims=[
            {
                "dimension": "SKILL",
                "technology": "FastAPI",
                "has_implementation_detail": True,
                "context_narrative": long_narrative,
                "metric_string": "90 ms",
            }
        ],
        core_competencies=["FastAPI"],
        verified_github_repos={},
    )
    assert evidence, "expected one evidence record for FastAPI"
    assert len(evidence[0]["claim_text"]) <= MAX_QUOTE_CHARS + 1  # +1 for the ellipsis
    assert evidence[0]["claim_text"].endswith("…")


def test_single_quote_passes_through_unchanged():
    quote = "Merancang ulang API pembayaran dengan FastAPI sehingga waktu respons turun dari 320 ms menjadi 90 ms."
    assert _as_excerpt(quote) == " ".join(quote.split())
    assert _as_excerpt(None) == ""
    assert _as_excerpt("   ") == ""