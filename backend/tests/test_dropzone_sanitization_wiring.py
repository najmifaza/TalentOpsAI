"""
HR dropzone sanitization wiring tests.

The sanitizer itself is covered in `test_pii_sanitizer.py`. This file verifies the
*endpoint* actually uses it on the metadata-free path, and that residual PII risk
is persisted as an anomaly instead of being dropped.

PRD Bab 6.4 requires the dropzone path to record potential false negatives
honestly; an endpoint that silently discards the report would violate that even
though the sanitizer itself behaved correctly.
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.api.candidates import hr_direct_upload


class FakeUpload:
    def __init__(self, filename, content):
        self.filename = filename
        self._content = content

    async def read(self):
        return self._content


def build_db():
    """Captures every statement so anomaly inserts can be asserted."""
    db = AsyncMock()
    statements = []

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        statements.append((sql, params))
        result = MagicMock()
        result.lastrowid = 1
        result.mappings.return_value.first.return_value = {"title": "Backend Engineer"}
        return result

    db.execute = AsyncMock(side_effect=mock_execute)
    db.commit = AsyncMock()
    db.statements = statements
    return db


async def run_upload(text, db):
    """Drives the endpoint with file parsing stubbed out."""
    upload = FakeUpload("cv.pdf", b"%PDF-1.4 fake")

    with patch("app.api.candidates.validate_file_magic_bytes", return_value="pdf"), \
         patch("app.api.candidates.extract_text_from_file", return_value=text), \
         patch("app.api.candidates.audit_document_hidden_text",
               return_value=(text, [], None)):
        return await hr_direct_upload(
            job_id=1,
            files=[upload],
            db=db,
            current_user={"id": 1, "role": "recruiter"},
        )


@pytest.mark.asyncio
async def test_dropzone_redacts_name_without_form_metadata():
    """
    The endpoint receives no name/email/phone. The applicant's name must still be
    removed from the stored text by header inference.
    """
    db = build_db()
    cv = "CURRICULUM VITAE\n\nBudi Santoso\nEmail: budi@example.com\nPython, FastAPI\n"

    result = await run_upload(cv, db)

    entry = result["candidates"][0]
    assert entry["sanitization"]["name_source"] == "header_inference"
    assert entry["sanitization"]["detected_name"] == "Budi Santoso"

    stored = next(p for sql, p in db.statements if "INSERT INTO CANDIDATES" in sql)
    assert "Budi Santoso" not in stored["sanitized_text"]
    assert "[NAME_REDACTED]" in stored["sanitized_text"]
    assert "Python" in stored["sanitized_text"]


@pytest.mark.asyncio
async def test_residual_risk_recorded_as_anomaly():
    """
    When no name can be resolved, the endpoint must persist a PII_RESIDUAL_RISK
    anomaly so a human can review it.
    """
    db = build_db()
    cv = "PROFIL\nSeorang engineer yang bekerja dengan Ahmad Fauzi di proyek besar.\n"

    result = await run_upload(cv, db)

    entry = result["candidates"][0]
    assert entry["sanitization"]["residual_risk"] is True
    assert entry["sanitization"]["limitations"]

    anomalies = [
        p for sql, p in db.statements
        if "INSERT INTO CANDIDATE_ANOMALIES" in sql
        and p and p.get("cand_id") == 1
    ]
    assert anomalies, "residual PII risk must be persisted as an anomaly"
    assert "Ahmad Fauzi" in anomalies[0]["desc"]


@pytest.mark.asyncio
async def test_clean_document_records_no_anomaly():
    """A fully-resolved document must not generate a spurious anomaly."""
    db = build_db()
    cv = "CURRICULUM VITAE\n\nCitra Dewi\nEmail: citra@example.com\nPython\n"

    result = await run_upload(cv, db)

    assert result["candidates"][0]["sanitization"]["residual_risk"] is False
    residual_anomalies = [
        p for sql, p in db.statements
        if "PII_RESIDUAL_RISK" in sql
    ]
    assert residual_anomalies == []
