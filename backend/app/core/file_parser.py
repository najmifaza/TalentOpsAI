import io
import re
import uuid
import secrets
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException

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
