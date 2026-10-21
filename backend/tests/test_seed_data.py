"""
Seed script guard.

The deployed recruiter account became unloggable because the upsert only refreshed
`email`, leaving a legacy argon2id hash in place while the backend verifies PBKDF2
only. These checks keep the password rotation path honest without needing a DB.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))

from backend.app.core.auth import hash_password, verify_password
from backend.scripts.seed_data import (
    DEFAULT_SEED_PASSWORD,
    USER_SEED_SQL,
    resolve_seed_password,
)


def test_user_upsert_rotates_password_hash():
    """Re-seeding must overwrite the stored hash, not just the email."""
    normalized = " ".join(USER_SEED_SQL.split())
    assert "ON DUPLICATE KEY UPDATE" in normalized
    assert "password_hash = VALUES(password_hash)" in normalized


def test_user_upsert_targets_the_seeded_account():
    """Guard against the id/username drifting away from the RBAC test fixtures."""
    normalized = " ".join(USER_SEED_SQL.split())
    assert "recruiter_talentops" in normalized
    assert "VALUES (1," in normalized


def test_seed_password_prefers_env_override(monkeypatch):
    """SEED_ADMIN_PASSWORD must win over the repository default."""
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", "RotatedAdminSecret2026!")
    assert resolve_seed_password() == "RotatedAdminSecret2026!"

    stored = hash_password(resolve_seed_password())
    assert verify_password("RotatedAdminSecret2026!", stored) is True
    assert verify_password(DEFAULT_SEED_PASSWORD, stored) is False


def test_seed_password_falls_back_to_default(monkeypatch):
    """Local setup keeps working without the env var."""
    monkeypatch.delenv("SEED_ADMIN_PASSWORD", raising=False)
    assert resolve_seed_password() == DEFAULT_SEED_PASSWORD
    assert verify_password(DEFAULT_SEED_PASSWORD, hash_password(DEFAULT_SEED_PASSWORD)) is True
