"""Seeds the four RBAC accounts. Needed once DEMO_MODE=False (login gate is live).

    SEED_DEFAULT_PASSWORD='<strong-password>' python scripts/seed_data.py
    SEED_DEFAULT_PASSWORD='...' SEED_RESET_PASSWORDS=true python scripts/seed_data.py

No password is baked into the repository: SEED_DEFAULT_PASSWORD is mandatory and the
script refuses to run without it. Existing accounts keep their hash unless
SEED_RESET_PASSWORDS=true, so a re-run cannot silently reset production credentials.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, text  # noqa: E402

from app.core.auth import hash_password  # noqa: E402
from app.core.config import settings  # noqa: E402

SEED_USERS = [
    ("admin", "admin@talentops.local", "admin"),
    ("recruiter", "recruiter@talentops.local", "recruiter"),
    ("hiring_manager", "hiring.manager@talentops.local", "hiring_manager"),
    ("compliance_officer", "compliance@talentops.local", "compliance_officer"),
]


def seed() -> int:
    password = os.getenv("SEED_DEFAULT_PASSWORD", "")
    if not password:
        print("SEED_DEFAULT_PASSWORD is required; refusing to seed a guessable password.")
        return 1

    reset = os.getenv("SEED_RESET_PASSWORDS", "").lower() in ("1", "true", "yes")
    password_hash = hash_password(password)

    engine = create_engine(settings.SYNC_DATABASE_URL, future=True)
    created = updated = 0
    with engine.begin() as conn:
        for username, email, role in SEED_USERS:
            existing = conn.execute(
                text("SELECT id FROM users WHERE username = :u"), {"u": username}
            ).first()
            if existing and reset:
                conn.execute(
                    text("UPDATE users SET password_hash = :h, failed_logins = 0, locked_until = NULL WHERE id = :id"),
                    {"h": password_hash, "id": existing[0]},
                )
                updated += 1
            elif not existing:
                conn.execute(
                    text("""
                        INSERT INTO users (username, email, password_hash, role)
                        VALUES (:u, :e, :h, :r)
                    """),
                    {"u": username, "e": email, "h": password_hash, "r": role},
                )
                created += 1
    engine.dispose()
    print(f"Seed done: {created} created, {updated} password(s) reset, {len(SEED_USERS) - created - updated} left untouched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(seed())