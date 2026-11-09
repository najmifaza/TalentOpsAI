"""
Deteksi berkas CV duplikat (dokumen: tingkat prioritas 2 butir 8).

`file_hash_sha256` sudah lama disimpan tetapi tidak pernah dibandingkan, sehingga satu
orang bisa melamar berkali-kali dengan berkas yang sama tanpa catatan apa pun. Berkas
duplikat ditandai, bukan ditolak: melamar ulang itu sah.
"""
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.candidates import hr_direct_upload

DUPLICATE_HASH_ROW = {"id": 7, "masked_identifier": "#TK-AAAAAA"}


class FakeUpload:
    def __init__(self, filename, content):
        self.filename = filename
        self._content = content

    async def read(self):
        return self._content


def build_db(duplicate_row):
    db = AsyncMock()
    statements = []

    async def mock_execute(statement, params=None):
        sql = str(statement).upper()
        statements.append((sql, params))
        result = MagicMock()
        result.lastrowid = 42
        result.rowcount = 1
        if "MASKED_IDENTIFIER FROM CANDIDATES" in sql:
            result.mappings.return_value.first.return_value = duplicate_row
        else:
            result.mappings.return_value.first.return_value = {"title": "Backend Engineer"}
        return result

    db.execute = AsyncMock(side_effect=mock_execute)
    db.commit = AsyncMock()
    db.statements = statements
    return db


async def run_upload(text, db):
    upload = FakeUpload("cv.pdf", b"%PDF-1.4 fake")
    with patch("app.api.candidates.validate_file_magic_bytes", return_value="pdf"), \
         patch("app.api.candidates.extract_text_from_file", return_value=text), \
         patch("app.api.candidates.audit_document_hidden_text", return_value=(text, [], None)):
        return await hr_direct_upload(
            job_id=1,
            files=[upload],
            applicant_meta=None,
            db=db,
            current_user={"id": 1, "role": "recruiter"},
        )


def _anomaly_inserts(db, needle="CANDIDATE_ANOMALIES"):
    """The anomaly type is written inline in the SQL, so filter on the statement."""
    return [(sql, params) for sql, params in db.statements if needle in sql]


@pytest.mark.asyncio
async def test_duplicate_hash_is_flagged_with_the_original_dossier():
    db = build_db(DUPLICATE_HASH_ROW)

    await run_upload("CURRICULUM VITAE\n\nBudi Santoso\nPython, FastAPI\n", db)

    duplicates = [p for _, p in _anomaly_inserts(db, "DUPLICATE_RESUME_UPLOAD")]
    assert len(duplicates) == 1
    assert duplicates[0]["cand_id"] == 42
    assert "#TK-AAAAAA" in duplicates[0]["desc"]
    assert "SHA-256" in duplicates[0]["desc"]


@pytest.mark.asyncio
async def test_unique_resume_inserts_no_duplicate_anomaly():
    db = build_db(None)

    await run_upload("CURRICULUM VITAE\n\nSiti Aminah\nReact, TypeScript\n", db)

    assert _anomaly_inserts(db, "DUPLICATE_RESUME_UPLOAD") == []


@pytest.mark.asyncio
async def test_lookup_is_scoped_to_the_same_job_agnostic_hash_and_excludes_self():
    db = build_db(None)

    await run_upload("CURRICULUM VITAE\n\nSari\nDocker\n", db)

    lookup = [sql for sql, _ in db.statements if "MASKED_IDENTIFIER FROM CANDIDATES" in sql]
    assert len(lookup) == 1
    assert "FILE_HASH_SHA256 = :FILE_HASH" in lookup[0]
    assert "ID <> :CAND_ID" in lookup[0]
    assert "IS_DELETED = FALSE" in lookup[0]

