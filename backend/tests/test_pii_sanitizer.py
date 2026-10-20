"""
PII sanitizer test suite (PRD Bab 6.4).

Covers the two ingestion paths and the specific ways a regex sanitizer leaks:

  - **Form-backed** (`/careers/{id}/apply`): explicit dictionary, high recall.
  - **Header-inferred** (`/candidates/upload`, HR dropzone): no metadata, so the
    name must be recovered from document structure or the leak is reported.

PRD Bab 6.4 requires the dropzone path to lean on heuristics *and* to record
false negatives honestly, and Bab 8 sets a >= 98% recall target on the evaluation
set, so leakage-resilience and residual reporting are tested as first-class
behaviour rather than nice-to-haves.
"""
import sys
import time
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.core.sanitizer import (
    infer_name_from_header,
    normalise_text,
    sanitize_pii,
    sanitize_resume,
)


STANDARD_CV = """CURRICULUM VITAE

BUDI SANTOSO
Jl. Merdeka No. 45, RT 03/RW 05, Kelurahan Ciumbuleuit
Kecamatan Cidadap, Kota Bandung, Jawa Barat 40142
Email: budi.santoso@gmail.com
HP: 0812-3456-7890
NIK: 3273010101900001
NPWP: 09.254.294.3-407.000
Tempat, Tanggal Lahir: Bandung, 1 Januari 1998
Agama: Islam
Status Perkawinan: Belum Menikah
Jenis Kelamin: Laki-laki
LinkedIn: linkedin.com/in/budisantoso
NIM: 2110304001

PENDIDIKAN
Universitas Jenderal Soedirman, Informatika, 2016-2020

PENGALAMAN
Backend Engineer at Tokopedia (2021-2023). Budi Santoso memimpin migrasi
ke microservices dan mengajar di Universitas Jenderal Soedirman sebagai asisten.
Menguasai Python, FastAPI, PostgreSQL. Pengalaman 3 tahun di bidang backend.
"""


# ---------------------------------------------------------------------------
# Header name inference — the core gap this work closes
# ---------------------------------------------------------------------------

def test_infers_name_from_labelled_field():
    text = "CURRICULUM VITAE\nNama: Citra Dewi Lestari\nEmail: citra@example.com\n"
    assert infer_name_from_header(text) == "Citra Dewi Lestari"


def test_infers_name_from_standalone_header_line():
    """The most common layout: name on its own line under the title."""
    text = "DAFTAR RIWAYAT HIDUP\n\nReza Pratama\nJl. Sudirman 1\n"
    assert infer_name_from_header(text) == "Reza Pratama"


def test_does_not_mistake_heading_for_name():
    """A bare "CURRICULUM VITAE" is a document title, not a person."""
    text = "CURRICULUM VITAE\n\nPROFIL\nBackend developer.\n"
    assert infer_name_from_header(text) is None


def test_strips_academic_titles():
    text = "Ir. Budi Santoso, S.Kom, M.T.\nEmail: x@y.com\n"
    assert infer_name_from_header(text) == "Budi Santoso"


def test_rejects_contact_line_as_name():
    """A line with digits or an @ is contact data, never a name."""
    text = "0812-3456-7890\nbudi@example.com\n"
    assert infer_name_from_header(text) is None


def test_header_inference_ignores_body_lines():
    """Only the header block is scanned, so a name in the narrative is not used."""
    text = "PROFIL\n" + ("x\n" * 10) + "Budi Santoso\n"
    assert infer_name_from_header(text) is None


# ---------------------------------------------------------------------------
# Dropzone path: no form metadata at all
# ---------------------------------------------------------------------------

def test_dropzone_redacts_name_without_form_data():
    """
    The regression this work fixes: with no form metadata the old sanitizer
    removed the email and phone but left the applicant's actual name in the
    first line of the document.
    """
    result = sanitize_resume(STANDARD_CV)

    assert result.detected_name == "BUDI SANTOSO"
    assert result.name_source == "header_inference"
    assert "BUDI SANTOSO" not in result.text
    assert "Budi Santoso" not in result.text
    assert "[NAME_REDACTED]" in result.text


def test_dropzone_redacts_all_identity_fields():
    result = sanitize_resume(STANDARD_CV)
    text = result.text

    assert "budi.santoso@gmail.com" not in text
    assert "0812-3456-7890" not in text
    assert "3273010101900001" not in text
    assert "09.254.294.3-407.000" not in text
    assert "Ciumbuleuit" not in text
    assert "linkedin.com/in/budisantoso" not in text
    assert "2110304001" not in text
    assert "Jenderal Soedirman" not in text


def test_dropzone_redacts_protected_attributes():
    """Religion, marital status and gender are discriminatory attributes."""
    text = sanitize_resume(STANDARD_CV).text
    assert "Islam" not in text
    assert "Belum Menikah" not in text
    assert "Laki-laki" not in text
    assert "Laki" not in text  # no dangling fragment left behind


def test_dropzone_preserves_technical_signal():
    """
    Over-redaction destroys the evaluable content. Skills, companies and
    durations are legitimate signal and must survive.
    """
    text = sanitize_resume(STANDARD_CV).text
    assert "Python" in text
    assert "FastAPI" in text
    assert "PostgreSQL" in text
    assert "Tokopedia" in text
    assert "3 tahun" in text          # years of experience, not age
    assert "2021-2023" in text


def test_dropzone_reports_inference_limitation():
    """The heuristic is disclosed, not presented as certain."""
    result = sanitize_resume(STANDARD_CV)
    assert any("HEADER_INFERENCE" in lim for lim in result.limitations)


# ---------------------------------------------------------------------------
# Leakage resilience (PRD Bab 8: name injected into free narrative)
# ---------------------------------------------------------------------------

def test_name_inside_project_narrative_is_redacted():
    result = sanitize_resume(STANDARD_CV)
    assert "Budi Santoso memimpin migrasi" not in result.text
    assert "memimpin migrasi" in result.text  # surrounding prose preserved


def test_university_inside_narrative_is_redacted():
    result = sanitize_resume(STANDARD_CV)
    assert result.stats["university"] >= 2
    assert "Universitas Jenderal Soedirman" not in result.text


def test_reversed_name_form_is_redacted():
    """Indonesian CVs often list names as "Santoso, Budi"."""
    text = "RIWAYAT HIDUP\nBudi Santoso\nSantoso, Budi - Backend Engineer\n"
    result = sanitize_resume(text)
    assert "Santoso, Budi" not in result.text


def test_unresolvable_name_is_reported_not_hidden():
    """
    When no name can be resolved, the sanitizer must say so rather than claim
    a clean result. This is the honest-false-negative requirement.
    """
    text = (
        "PROFIL\n"
        "Seorang engineer yang pernah bekerja dengan Ahmad Fauzi di proyek besar.\n"
    )
    result = sanitize_resume(text)

    assert result.detected_name is None
    assert result.name_source == "none"
    assert any("NAME_NOT_RESOLVED" in lim for lim in result.limitations)
    assert "Ahmad Fauzi" in result.residual_name_candidates
    assert result.has_residual_risk is True


def test_residual_list_is_bounded():
    """The report must not dump an unbounded list of capitalised words."""
    text = "PROFIL\n" + " ".join(f"Nama{i} Palsu{i}" for i in range(40)) + "\n"
    result = sanitize_resume(text)
    assert len(result.residual_name_candidates) <= 10


# ---------------------------------------------------------------------------
# Form-backed path: existing behaviour preserved
# ---------------------------------------------------------------------------

def test_form_name_takes_precedence_over_header():
    text = "CURRICULUM VITAE\nReza Pratama\nBudi Santoso menulis kode.\n"
    result = sanitize_resume(text, known_name="Budi Santoso")
    assert result.detected_name == "Budi Santoso"
    assert result.name_source == "form"
    assert "Budi Santoso" not in result.text


def test_backward_compatible_signature():
    """`sanitize_pii` must keep returning a 2-tuple for existing callers."""
    sanitized, stats = sanitize_pii(
        "Najmi Faza\nnajmi@example.com\n+6281234567890\nUniversitas Jenderal Soedirman\n",
        known_name="Najmi Faza",
        known_email="najmi@example.com",
        known_phone="+6281234567890",
    )
    assert isinstance(sanitized, str)
    assert isinstance(stats, dict)
    assert "[NAME_REDACTED]" in sanitized
    assert "[EMAIL_REDACTED]" in sanitized
    assert "[UNIVERSITY_REDACTED]" in sanitized


def test_name_parts_are_redacted_separately():
    """A CV may mention only the first name in narrative."""
    text = "PROFIL\nBudi Santoso\nSaya Budi, engineer.\n"
    result = sanitize_resume(text)
    assert "Budi" not in result.text


# ---------------------------------------------------------------------------
# Obfuscation and Unicode hardening
# ---------------------------------------------------------------------------

def test_zero_width_characters_cannot_hide_an_email():
    text = "Kontak: budi@exa\u200bmple.com\n"
    result = sanitize_resume(text)
    assert "example.com" not in result.text
    assert "exa" not in result.text.replace("[EMAIL_REDACTED]", "")


def test_fullwidth_at_sign_is_normalised():
    """NFKC folds the full-width ＠ to @ so the email pattern still fires."""
    assert "@" in normalise_text("budi\uff20gmail.com")
    result = sanitize_resume("Kontak: budi\uff20gmail.com\n")
    assert "gmail.com" not in result.text


def test_bracket_obfuscated_email_is_redacted():
    text = "Email: budi.santoso [at] gmail [dot] com\n"
    result = sanitize_resume(text)
    assert "gmail" not in result.text


def test_phone_with_mixed_separators():
    for phone in ["0812-3456-7890", "0812 3456 7890", "0812.3456.7890", "+62 812 3456 7890"]:
        result = sanitize_resume(f"HP: {phone}\nBudi Santoso\n")
        digits = phone.replace("-", "").replace(" ", "").replace(".", "")
        assert digits not in result.text.replace("-", "").replace(" ", "").replace(".", "")


# ---------------------------------------------------------------------------
# Regression guards for ordering and boundaries
# ---------------------------------------------------------------------------

def test_name_redaction_does_not_shred_the_email():
    """
    Running the name dictionary before the email pattern turns
    `budi.santoso@gmail.com` into `[NAME_REDACTED].[NAME_REDACTED]@gmail.com`,
    leaving the mail domain exposed. Contact redaction must come first.
    """
    text = "Budi Santoso\nbudi.santoso@gmail.com\n"
    result = sanitize_resume(text)
    assert "gmail.com" not in result.text
    assert "@gmail" not in result.text
    assert "[EMAIL_REDACTED]" in result.text


def test_phone_redaction_preserves_line_breaks():
    """
    Using \\s as a separator lets the phone pattern eat the newline and glue the
    next field onto the redaction marker, corrupting the document structure.
    """
    text = "HP: 0812-3456-7890\nNIK: 3273010101900001\n"
    result = sanitize_resume(text)
    assert "[PHONE_REDACTED]\n" in result.text
    assert "[NIK_REDACTED]" in result.text


def test_nik_is_sixteen_digits_and_fully_consumed():
    result = sanitize_resume("NIK: 3273010101900001\n")
    assert result.stats["nik"] == 1
    assert "3273010101900001" not in result.text
    assert "900001" not in result.text  # no tail left behind


def test_bare_dates_are_not_redacted():
    """Employment dates are timeline signal; only labelled birth dates are PII."""
    result = sanitize_resume("Backend Engineer, 1 Januari 2021 - 31 Desember 2023\n")
    assert "1 Januari 2021" in result.text
    assert result.stats["dob"] == 0


def test_labelled_birth_date_is_redacted():
    result = sanitize_resume("Tempat, Tanggal Lahir: Bandung, 1 Januari 1998\n")
    assert result.stats["dob"] == 1
    assert "1 Januari 1998" not in result.text


def test_employment_duration_not_confused_with_age():
    result = sanitize_resume("Pengalaman 5 tahun di bidang backend\n")
    assert "5 tahun" in result.text
    assert result.stats["age"] == 0


def test_labelled_age_is_redacted():
    result = sanitize_resume("Usia: 23 tahun\n")
    assert result.stats["age"] == 1
    assert "23 tahun" not in result.text


# ---------------------------------------------------------------------------
# Idempotency and empty input
# ---------------------------------------------------------------------------

def test_sanitization_is_idempotent():
    """Re-running must not stack markers or re-consume text."""
    once = sanitize_resume(STANDARD_CV).text
    twice = sanitize_resume(once).text
    assert once == twice


def test_empty_input_returns_empty_result():
    result = sanitize_resume("")
    assert result.text == ""
    assert result.total_redactions == 0
    assert result.has_residual_risk is False


def test_whitespace_only_input():
    result = sanitize_resume("   \n\t\n  ")
    assert result.text.strip() == ""


# ---------------------------------------------------------------------------
# Performance (PRD Bab 6.4: < 20 ms)
# ---------------------------------------------------------------------------

def test_latency_under_budget():
    """The sanitizer must stay well inside the 20 ms ingestion budget."""
    long_cv = STANDARD_CV * 8
    sanitize_resume(long_cv)  # warm the regex cache

    start = time.perf_counter()
    for _ in range(10):
        sanitize_resume(long_cv)
    elapsed_ms = (time.perf_counter() - start) / 10 * 1000

    assert elapsed_ms < 20, f"sanitizer took {elapsed_ms:.1f} ms per document"


# ---------------------------------------------------------------------------
# Recall on the synthetic evaluation set (PRD Bab 8: >= 98%)
# ---------------------------------------------------------------------------

def test_recall_on_identity_fields():
    """
    Each identity field must be removed. Recall is computed over the fields we
    know are present, which is the same measure the PRD evaluation uses.
    """
    result = sanitize_resume(STANDARD_CV)
    must_vanish = [
        "BUDI SANTOSO", "budi.santoso@gmail.com", "0812-3456-7890",
        "3273010101900001", "09.254.294.3-407.000", "Ciumbuleuit",
        "Jenderal Soedirman", "linkedin.com/in/budisantoso", "2110304001",
        "Islam", "Belum Menikah", "Laki-laki",
    ]
    leaked = [v for v in must_vanish if v.lower() in result.text.lower()]
    recall = 1 - (len(leaked) / len(must_vanish))
    assert recall >= 0.98, f"leaked {leaked}"
