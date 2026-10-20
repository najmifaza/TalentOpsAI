import base64
import hmac
import hashlib
import os
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

def _get_master_kek() -> bytes:
    raw_kek = settings.MASTER_KEK
    # Handle base64 or raw 32 bytes
    try:
        decoded = base64.b64decode(raw_kek)
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    # fallback or sha256 to guarantee 32 bytes
    return hashlib.sha256(raw_kek.encode("utf-8")).digest()

def generate_dek() -> bytes:
    """Generate 256-bit (32 bytes) random Data Encryption Key."""
    return AESGCM.generate_key(bit_length=256)

def encrypt_dek(dek: bytes) -> bytes:
    """Encrypt DEK using Master KEK via AES-256-GCM. Returns nonce (12B) + ciphertext + tag."""
    kek = _get_master_kek()
    aesgcm = AESGCM(kek)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, dek, None)
    return nonce + ciphertext

def decrypt_dek(encrypted_dek: bytes) -> bytes:
    """Decrypt encrypted DEK using Master KEK."""
    kek = _get_master_kek()
    aesgcm = AESGCM(kek)
    nonce = encrypted_dek[:12]
    ciphertext = encrypted_dek[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)

def encrypt_pii(plaintext: str, dek: bytes) -> bytes:
    """Encrypt sensitive string with DEK via AES-256-GCM."""
    if not plaintext:
        return b""
    aesgcm = AESGCM(dek)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return nonce + ciphertext

def decrypt_pii(ciphertext_bytes: bytes, dek: bytes) -> str:
    """Decrypt sensitive ciphertext using candidate DEK."""
    if not ciphertext_bytes:
        return ""
    aesgcm = AESGCM(dek)
    nonce = ciphertext_bytes[:12]
    ciphertext = ciphertext_bytes[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")

def compute_blind_index(value: str) -> str:
    """Compute HMAC-SHA256 blind index for searchable privacy data (e.g. email)."""
    if not value:
        return ""
    normalized = value.strip().lower().encode("utf-8")
    pepper = settings.HMAC_PEPPER.encode("utf-8")
    return hmac.new(pepper, normalized, hashlib.sha256).hexdigest()


def encrypt_with_kek(plaintext: str) -> bytes:
    """
    Encrypt a short secret (e.g. OAuth access/refresh token) directly under the
    Master KEK via AES-256-GCM. Returns nonce (12B) + ciphertext + tag.
    """
    if not plaintext:
        return b""
    aesgcm = AESGCM(_get_master_kek())
    nonce = os.urandom(12)
    return nonce + aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)


def decrypt_with_kek(ciphertext_bytes: bytes) -> str:
    """Decrypt a KEK-sealed secret. Returns '' for empty input."""
    if not ciphertext_bytes:
        return ""
    aesgcm = AESGCM(_get_master_kek())
    nonce = ciphertext_bytes[:12]
    ciphertext = ciphertext_bytes[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")

def generate_tombstone_hash() -> str:
    """Generate random tombstone hash to overwrite blind index on crypto-shredding."""
    return hashlib.sha256(os.urandom(32)).hexdigest()
