"""Resume storage + blind-review name hint.

The dossier advertises a download button based on `resume_file_available`, so the
bytes must actually exist on disk. These tests pin the storage contract: opaque
names, traversal rejection, and the download endpoint's auth + audit trail.

PRD Bab 6.2 butir 4: the name shown before approval is a derived hint, never a
decryption of the stored PII.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.core.file_parser import (
    delete_resume_file,
    mask_name,
    resolve_resume_file,
    resume_storage_dir,
    save_resume_bytes,
)


PDF_BYTES = b"%PDF-1.4\n% test payload\n"


# --- name hint ---------------------------------------------------------------

def test_mask_name_keeps_outer_letters():
    assert mask_name("Budi Santoso") == "B**i S*****o"


def test_mask_name_short_words():
    assert mask_name("Al") == "A*"
    assert mask_name("X") == "*"


def test_mask_name_never_leaks_full_word():
    hint = mask_name("Timotius Willy Narendra")
    for word in ("Timotius", "Willy", "Narendra"):
        assert word not in hint


def test_mask_name_empty():
    assert mask_name("") == ""
    assert mask_name(None) == ""


# --- storage ----------------------------------------------------------------

def test_save_and_resolve_roundtrip():
    stored = save_resume_bytes(PDF_BYTES, "pdf")
    try:
        path = resolve_resume_file(stored)
        assert path is not None
        assert path.read_bytes() == PDF_BYTES
        assert path.suffix == ".pdf"
    finally:
        delete_resume_file(stored)


def test_stored_name_is_opaque():
    """The applicant's own filename must not survive into the filesystem."""
    stored = save_resume_bytes(PDF_BYTES, "pdf")
    try:
        assert "budi" not in stored.lower()
        assert stored.endswith(".pdf")
    finally:
        delete_resume_file(stored)


def test_resolve_rejects_path_traversal():
    assert resolve_resume_file("../../etc/passwd") is None
    assert resolve_resume_file("/etc/passwd") is None


def test_resolve_missing_file_returns_none():
    assert resolve_resume_file("does-not-exist.pdf") is None
    assert resolve_resume_file(None) is None


def test_delete_removes_file():
    stored = save_resume_bytes(PDF_BYTES, "pdf")
    assert delete_resume_file(stored) is True
    assert resolve_resume_file(stored) is None


def test_storage_dir_is_under_backend():
    """Tests redirect this via conftest; production falls back to backend/storage."""
    assert resume_storage_dir().is_dir()


# --- download endpoint ------------------------------------------------------

def _mock_db(row):
    db = AsyncMock()
    statements = []

    async def mock_execute(statement, params=None):
        statements.append((str(statement).upper(), params))
        result = MagicMock()
        result.mappings.return_value.first.return_value = row
        return result

    db.execute = AsyncMock(side_effect=mock_execute)
    db.commit = AsyncMock()
    db.statements = statements
    return db


@pytest.mark.asyncio
async def test_download_logs_pii_access():
    from app.api.candidates import download_candidate_resume

    stored = save_resume_bytes(PDF_BYTES, "pdf")
    try:
        db = _mock_db({
            "id": 10,
            "masked_identifier": "#TK-A1B2C3",
            "resume_file_path": stored,
            "is_deleted": False,
        })
        request = MagicMock()
        request.headers.get.return_value = "10.0.0.5"

        response = await download_candidate_resume(
            candidate_id=10,
            request=request,
            db=db,
            current_user={"id": 7, "role": "recruiter"},
        )

        assert Path(response.path).read_bytes() == PDF_BYTES
        assert response.media_type == "application/pdf"

        logs = [p for sql, p in db.statements if "PII_ACCESS_LOGS" in sql]
        assert logs, "download must be written to the PII audit trail"
        assert logs[0]["cid"] == 10
        assert "RESUME_FILE_DOWNLOAD" in logs[0]["reason"]
        assert logs[0]["uid"] == 7
    finally:
        delete_resume_file(stored)


@pytest.mark.asyncio
async def test_download_404_when_file_missing():
    from app.api.candidates import download_candidate_resume

    db = _mock_db({
        "id": 10,
        "masked_identifier": "#TK-A1B2C3",
        "resume_file_path": "gone.pdf",
        "is_deleted": False,
    })
    request = MagicMock()
    request.headers.get.return_value = "10.0.0.5"

    with pytest.raises(HTTPException) as exc:
        await download_candidate_resume(
            candidate_id=10,
            request=request,
            db=db,
            current_user={"id": 7, "role": "recruiter"},
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "RESUME_FILE_NOT_STORED"


@pytest.mark.asyncio
async def test_download_404_for_deleted_candidate():
    from app.api.candidates import download_candidate_resume

    db = _mock_db({
        "id": 10,
        "masked_identifier": "#TK-A1B2C3",
        "resume_file_path": "x.pdf",
        "is_deleted": True,
    })
    request = MagicMock()
    request.headers.get.return_value = "10.0.0.5"

    with pytest.raises(HTTPException) as exc:
        await download_candidate_resume(
            candidate_id=10,
            request=request,
            db=db,
            current_user={"id": 7, "role": "recruiter"},
        )

    assert exc.value.status_code == 404


# --- erasure deletes the file, after commit ---------------------------------

@pytest.mark.asyncio
async def test_erasure_returns_file_name_without_deleting_it():
    """The service must NOT touch disk: the caller deletes after commit."""
    from app.core.erasure import execute_talentops_erasure

    stored = save_resume_bytes(PDF_BYTES, "pdf")
    try:
        db = _mock_db({
            "id": 10,
            "masked_identifier": "#TK-A1B2C3",
            "resume_file_path": stored,
            "is_deleted": False,
        })

        result = await execute_talentops_erasure(
            db=db,
            candidate_id=10,
            reason="APPLICANT_VOLUNTARY_WITHDRAWAL_VIA_PORTAL",
            ip_address="10.0.0.5",
            user_id=1,
        )

        assert result["success"] is True
        assert result["stored_resume_name"] == stored
        assert resolve_resume_file(stored) is not None, "file must survive until commit"
    finally:
        delete_resume_file(stored)
