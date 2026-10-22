import io
import re
import uuid
import secrets
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException
from app.core.config import settings

MAGIC_PDF = b"%PDF-"
MAGIC_ZIP_DOCX = b"PK\x03\x04"

def validate_file_magic_bytes(content: bytes, filename: str) -> str:
    """
    Validates physical binary header (magic bytes) of uploaded resume.
    Returns detected format: 'pdf' or 'docx'.
    Raises HTTPException 415 if bytes don't match supported formats.
    """
    if len(content) < 4:
        raise HTTPException(
            status_code=415,
            detail="FILE_TOO_SMALL_OR_EMPTY: Uploaded file is empty or corrupted."
        )

    if content.startswith(MAGIC_PDF):
        return "pdf"
    elif content.startswith(MAGIC_ZIP_DOCX):
        return "docx"
    else:
        raise HTTPException(
            status_code=415,
            detail="UNSUPPORTED_MEDIA_TYPE: File must be a valid PDF (%PDF-) or DOCX (PK ZIP structure)."
        )

def extract_text_from_file(content: bytes, file_format: str) -> str:
    """
    Extracts text in-memory from PDF or DOCX bytes without writing to disk.
    """
    if file_format == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            pages_text = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            return "\n".join(pages_text)
        except Exception:
            # Fallback regex string extraction for mock or raw text
            return content.decode("utf-8", errors="ignore")
    elif file_format == "docx":
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception:
            return content.decode("utf-8", errors="ignore")
    else:
        return content.decode("utf-8", errors="ignore")

def generate_masked_identifier() -> str:
    """
    Generates public masked identifier format: #TK-[6-HEX]
    e.g. #TK-A17C9B (16.7M variations).
    """
    token_hex = secrets.token_hex(3).upper()
    return f"#TK-{token_hex}"

def generate_tracking_token() -> str:
    """Generates secure high-entropy UUIDv4 string for candidate tracking."""
    return str(uuid.uuid4())


def mask_name(name: str) -> str:
    """Blind-review display hint: keeps the outer letters of every word.

    `Budi Santoso` -> `B**i S*****o`. Derived once at ingest and stored, so the
    dossier can show a readable placeholder without decrypting PII on every GET.
    """
    words = []
    for word in (name or "").split():
        if len(word) <= 1:
            words.append("*")
        elif len(word) == 2:
            words.append(f"{word[0]}*")
        else:
            words.append(f"{word[0]}{'*' * (len(word) - 2)}{word[-1]}")
    return " ".join(words)[:120]


def _storage_path() -> Path:
    """Storage location without touching the filesystem (safe on read paths)."""
    return Path(settings.RESUME_STORAGE_DIR or (Path(__file__).resolve().parents[2] / "storage" / "resumes"))


def resume_storage_dir() -> Path:
    """Directory holding original uploads, created on first write."""
    base = _storage_path()
    base.mkdir(parents=True, exist_ok=True)
    return base


def save_resume_bytes(content: bytes, file_format: str) -> str:
    """Writes the original upload under a random name and returns that name.

    The name is opaque so a directory listing leaks nothing about the applicant.
    """
    stored_name = f"{uuid.uuid4().hex}.{file_format}"
    (resume_storage_dir() / stored_name).write_bytes(content)
    return stored_name


def resolve_resume_file(stored_name: Optional[str]) -> Optional[Path]:
    """Resolves a stored resume name, rejecting anything outside the storage dir.

    Read-only and never raises: a missing directory or an unreadable one means
    "no file", not a failed request. This is called on every dossier GET, so an
    OSError here used to turn the whole page into a 500.
    """
    if not stored_name:
        return None
    try:
        path = _storage_path() / Path(stored_name).name
        return path if path.is_file() else None
    except OSError:
        return None


def delete_resume_file(stored_name: Optional[str]) -> bool:
    """Removes the stored original (UU PDP right to erasure)."""
    path = resolve_resume_file(stored_name)
    if not path:
        return False
    try:
        path.unlink()
        return True
    except OSError:
        return False
