"""Storage-directory robustness.

`GET /api/candidates/{id}` reports `resume_file_available` by probing the storage
directory. On the VPS the directory was root-owned for a few minutes and the probe
raised PermissionError, which turned the entire dossier page into a 500 — a
cosmetic flag taking down the page it decorates.

Reads must degrade to "no file". Writes must still fail loudly: an upload that
silently loses the applicant's document is worse than a 500.
"""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from app.core import file_parser


def test_resolve_swallows_permission_error():
    with patch.object(file_parser, "_storage_path", side_effect=PermissionError(13, "denied")):
        assert file_parser.resolve_resume_file("abc.pdf") is None


def test_resolve_swallows_unreadable_directory():
    """is_file() itself can raise; that must not escape either."""
    class Unreadable:
        def __truediv__(self, other):
            return self

        def is_file(self):
            raise PermissionError(13, "denied")

    with patch.object(file_parser, "_storage_path", return_value=Unreadable()):
        assert file_parser.resolve_resume_file("abc.pdf") is None


def test_delete_returns_false_when_directory_unreadable():
    with patch.object(file_parser, "_storage_path", side_effect=PermissionError(13, "denied")):
        assert file_parser.delete_resume_file("abc.pdf") is False


def test_save_still_raises_on_unwritable_storage():
    """Uploads must not pretend success: losing the document silently is worse."""
    with patch.object(file_parser, "_storage_path", side_effect=PermissionError(13, "denied")):
        with pytest.raises(PermissionError):
            file_parser.save_resume_bytes(b"%PDF-1.4\n", "pdf")
