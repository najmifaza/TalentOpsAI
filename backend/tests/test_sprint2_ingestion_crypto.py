import pytest
from app.core.crypto import (
    generate_dek,
    encrypt_dek,
    decrypt_dek,
    encrypt_pii,
    decrypt_pii,
    compute_blind_index,
    generate_tombstone_hash,
)
from app.core.sanitizer import sanitize_pii
from app.adapters.github import github_adapter
from app.core.file_parser import (
    validate_file_magic_bytes,
    MAGIC_PDF,
    MAGIC_ZIP_DOCX,
    generate_masked_identifier,
    generate_tracking_token,
)

def test_crypto_envelope_flow():
    # 1. DEK Generation & Encryption
    dek = generate_dek()
    assert len(dek) == 32
    enc_dek = encrypt_dek(dek)
    assert enc_dek != dek

    # 2. DEK Decryption via Master KEK
    decrypted_dek = decrypt_dek(enc_dek)
    assert decrypted_dek == dek

    # 3. PII field encryption with DEK
    secret_email = "najmi.developer@example.com"
    enc_email = encrypt_pii(secret_email, dek)
    assert enc_email != secret_email.encode("utf-8")

    # 4. Decrypt PII
    decrypted_email = decrypt_pii(enc_email, dek)
    assert decrypted_email == secret_email

def test_blind_indexing():
    email1 = "Budi.Santoso@Example.com "
    email2 = "budi.santoso@example.com"
    idx1 = compute_blind_index(email1)
    idx2 = compute_blind_index(email2)
    assert idx1 == idx2
    assert len(idx1) == 64

    tombstone = generate_tombstone_hash()
    assert tombstone != idx1
    assert len(tombstone) == 64

def test_sanitizer_pii_two_way():
    sample_text = (
        "Nama saya Najmi Faza, lulusan dari Universitas Jenderal Soedirman. "
        "Hubungi saya di najmi@example.com atau +6281234567890. Saya pria."
    )
    sanitized, stats = sanitize_pii(
        sample_text,
        known_name="Najmi Faza",
        known_email="najmi@example.com",
        known_phone="+6281234567890",
    )
    assert "[NAME_REDACTED]" in sanitized
    assert "Najmi" not in sanitized
    assert "[EMAIL_REDACTED]" in sanitized
    assert "najmi@example.com" not in sanitized
    assert "[PHONE_REDACTED]" in sanitized
    assert "81234567890" not in sanitized
    assert "[UNIVERSITY_REDACTED]" in sanitized
    assert "Universitas Jenderal Soedirman" not in sanitized
    assert stats["name"] >= 1
    assert stats["email"] >= 1

def test_file_magic_bytes_validation():
    # Valid PDF
    fake_pdf = MAGIC_PDF + b"test content"
    assert validate_file_magic_bytes(fake_pdf, "test.pdf") == "pdf"

    # Valid DOCX
    fake_docx = MAGIC_ZIP_DOCX + b"dummy docx"
    assert validate_file_magic_bytes(fake_docx, "test.docx") == "docx"

    # Invalid
    with pytest.raises(Exception):
        validate_file_magic_bytes(b"INVALID_HEADER", "bad.exe")

def test_identifier_and_token_formats():
    masked = generate_masked_identifier()
    assert masked.startswith("#TK-")
    assert len(masked) == 10

    token = generate_tracking_token()
    assert len(token) == 36  # UUIDv4 format

def test_github_adapter_regex():
    assert github_adapter.parse_repo_url("https://github.com/torvalds/linux") == ("torvalds", "linux")
    assert github_adapter.parse_repo_url("https://github.com/torvalds/linux.git") == ("torvalds", "linux")
    assert github_adapter.parse_repo_url("http://malicious-site.com/torvalds/linux") is None
    assert github_adapter.parse_repo_url("https://github.com/invalid") is None
