"""
PII sanitizer recall on the real golden dataset (PRD Bab 6.4 / Bab 9.2).

Complements `test_benchmark_sprint4.py`, which only measures recall on synthetic
entities injected into hand-written narratives. This suite runs the sanitizer over
the 25 CVs that already ship in `backend/data/golden_dataset/` — real resume
layouts, no injected strings.

Ground truth is derived independently of the sanitizer's own heuristics:
  - name  -> from the filename slug (`cv_01_budi_santoso` -> "Budi Santoso"),
             accepted only when it also matches the document's first line
  - email -> first address in the header block
  - phone -> the token after the `Phone:` label
  - university -> the institution phrase as it appears in the body
  - url   -> GitHub/portfolio links

Every entity is then checked for *survival* in the sanitized output by plain
substring match. Using the same regex to find an entity and to check that it is
gone would be circular; survival checking is not.

The sanitizer is called with NO metadata at all (`sanitize_resume(text)`), i.e.
the HR dropzone path, which is the harder of the two modes — the name must be
inferred from the header rather than supplied by a form.
"""
import glob
import os
import re
import statistics
import sys
import time
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.core.file_parser import extract_text_from_file
from app.core.sanitizer import sanitize_resume

DATASET_DIR = backend_dir / "data" / "golden_dataset"

# Tokens that must survive: redacting a candidate's identity must not destroy the
# technical signal the scoring engine depends on.
TECH_TOKENS = [
    "FastAPI", "PostgreSQL", "Docker", "Redis", "Kubernetes", "Python",
    "Django", "MariaDB", "CI/CD", "GitHub Actions", "Linux", "Terraform",
]

RECALL_TARGET = 98.0  # PRD Bab 9.2


def _cv_files():
    return sorted(glob.glob(str(DATASET_DIR / "cv_*.txt")))


def _name_from_filename(path):
    slug = re.sub(r"^cv_\d+_", "", Path(path).stem)
    return " ".join(word.capitalize() for word in slug.split("_"))


def _ground_truth(text, path):
    """Enumerates the PII actually present in this CV, without using sanitizer internals."""
    entities = []

    name = _name_from_filename(path)
    first_line = text.splitlines()[0].strip() if text.splitlines() else ""
    if first_line.lower() == name.lower():
        entities.append(("name", name))

    email = re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", text)
    if email:
        entities.append(("email", email.group(0)))

    phone = re.search(r"Phone:\s*(\S+)", text)
    if phone:
        entities.append(("phone", phone.group(1)))

    university = re.search(
        r"((?:Universitas|Institut|Politeknik)\s+[A-Z][\w.]*(?:\s+[A-Z][\w.]*){0,4})", text
    )
    if university:
        entities.append(("university", university.group(1)))

    for url in sorted(set(re.findall(r"https?://[^\s,;)\]}]+", text))):
        if re.search(r"github\.com|behance|dribbble|notion|linkedin|kaggle", url):
            entities.append(("url", url))

    return entities


def test_golden_dataset_is_present():
    """The measurement is meaningless without the corpus; fail loudly if it is missing."""
    files = _cv_files()
    assert len(files) == 25, f"expected 25 golden CVs, found {len(files)}"
    for path in files:
        assert Path(path).with_suffix(".docx").exists(), f"missing DOCX pair for {path}"


def test_sanitizer_recall_on_25_real_cvs():
    """Recall over every PII entity in the corpus, HR dropzone path (no metadata)."""
    total = 0
    redacted = 0
    leaks = []
    per_cv = []

    for path in _cv_files():
        text = Path(path).read_text(encoding="utf-8")
        result = sanitize_resume(text)

        entities = _ground_truth(text, path)
        assert entities, f"no PII detected in ground truth for {Path(path).name}"

        cv_hits = 0
        for kind, value in entities:
            total += 1
            if value.lower() in result.text.lower():
                leaks.append((Path(path).name, kind, value))
            else:
                redacted += 1
                cv_hits += 1
        per_cv.append((Path(path).name, cv_hits, len(entities), result.name_source))

    recall = redacted / total * 100.0

    for name, hits, expected, source in per_cv:
        print(f"  {name}: {hits}/{expected} redacted (name_source={source})")
    print(f"Golden-dataset PII recall: {recall:.2f}% ({redacted}/{total} entities)")
    if leaks:
        print("Leaked entities:")
        for leak in leaks:
            print(f"  {leak}")

    assert not leaks, f"{len(leaks)} PII entities survived sanitization: {leaks}"
    assert recall >= RECALL_TARGET, f"recall {recall:.2f}% below PRD target {RECALL_TARGET}%"


def test_name_inferred_from_header_for_every_cv():
    """The dropzone path has no form metadata, so every name must come from the header."""
    for path in _cv_files():
        text = Path(path).read_text(encoding="utf-8")
        result = sanitize_resume(text)
        expected_name = _name_from_filename(path)

        assert result.name_source == "header_inference", f"{Path(path).name}: name_source={result.name_source}"
        assert result.detected_name == expected_name, (
            f"{Path(path).name}: inferred {result.detected_name!r}, expected {expected_name!r}"
        )
        assert not result.residual_name_candidates, (
            f"{Path(path).name}: residual name candidates {result.residual_name_candidates}"
        )


def test_form_backed_path_matches_dropzone_recall():
    """Supplying name/email/phone explicitly must not be worse than inferring them."""
    for path in _cv_files():
        text = Path(path).read_text(encoding="utf-8")
        entities = _ground_truth(text, path)
        known = {kind: value for kind, value in entities}

        result = sanitize_resume(
            text,
            known_name=known.get("name"),
            known_email=known.get("email"),
            known_phone=known.get("phone"),
        )

        for kind, value in entities:
            assert value.lower() not in result.text.lower(), (
                f"{Path(path).name}: {kind} {value!r} survived the form-backed path"
            )


def test_sanitization_preserves_technical_signal():
    """Identity redaction must not shred the competencies the scorer reads."""
    destroyed = []
    for path in _cv_files():
        text = Path(path).read_text(encoding="utf-8")
        sanitized = sanitize_resume(text).text
        for token in TECH_TOKENS:
            if token in text and token not in sanitized:
                destroyed.append((Path(path).name, token))

    assert not destroyed, f"sanitizer destroyed technical tokens: {destroyed}"


def test_sanitizer_latency_on_real_documents():
    """Real CVs are ~5x longer than the synthetic snippets; stay inside the budget."""
    latencies = []
    for path in _cv_files():
        text = Path(path).read_text(encoding="utf-8")
        start = time.perf_counter()
        sanitize_resume(text)
        latencies.append((time.perf_counter() - start) * 1000)

    mean_ms = statistics.mean(latencies)
    p95_ms = sorted(latencies)[max(int(0.95 * len(latencies)) - 1, 0)]
    print(f"Real-CV sanitizer latency: mean={mean_ms:.3f}ms p95={p95_ms:.3f}ms max={max(latencies):.3f}ms")

    assert mean_ms < 20.0, f"mean latency {mean_ms:.2f}ms exceeds the 20ms budget"
    assert p95_ms < 20.0, f"p95 latency {p95_ms:.2f}ms exceeds the 20ms budget"


def test_docx_dropzone_path_redacts_identity():
    """End-to-end: real DOCX bytes -> parser -> sanitizer, the actual HR upload path."""
    path = DATASET_DIR / "cv_01_budi_santoso.docx"
    text = extract_text_from_file(path.read_bytes(), "docx")
    result = sanitize_resume(text)

    assert "Budi Santoso" not in result.text
    assert "budi.santoso@email.com" not in result.text
    assert result.name_source == "header_inference"
    assert "FastAPI" in result.text
