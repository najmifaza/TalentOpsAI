"""Applies every SQL file in backend/migrations, in filename order.

Idempotent: every statement in the migrations uses IF NOT EXISTS / MODIFY / guarded
INSERT, so re-running after a new migration file lands is a no-op for the rest.

    python scripts/init_db.py

Reads SYNC_DATABASE_URL (pymysql) from app.core.config, i.e. from backend/.env.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, text  # noqa: E402

from app.core.config import settings  # noqa: E402

MIGRATIONS_DIR = BACKEND_DIR / "migrations"


def _mask_dsn(dsn: str) -> str:
    """Hides the password before it reaches stdout, shell history or journalctl."""
    marker = "://"
    if marker not in dsn or "@" not in dsn:
        return dsn
    scheme, rest = dsn.split(marker, 1)
    credentials, host = rest.rsplit("@", 1)
    user = credentials.split(":", 1)[0]
    return f"{scheme}{marker}{user}:***@{host}"


def split_statements(sql_content: str):
    """Splits a migration into statements, dropping comment lines FIRST.

    Splitting on ";" before removing comments cut statements in half whenever a
    comment contained a semicolon (that is how migration 004 was once corrupted).
    Pinned by tests/test_migration_parsing.py.
    """
    without_comments = "\n".join(
        line for line in sql_content.splitlines() if not line.strip().startswith("--")
    )
    return [s.strip() for s in without_comments.split(";") if s.strip()]


def apply_migrations() -> int:
    print(f"Migrations dir : {MIGRATIONS_DIR}")
    print(f"Target DSN     : {_mask_dsn(settings.SYNC_DATABASE_URL)}")

    engine = create_engine(settings.SYNC_DATABASE_URL, future=True)
    applied = 0
    with engine.begin() as conn:
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            statements = split_statements(path.read_text(encoding="utf-8"))
            for stmt in statements:
                conn.execute(text(stmt))
            applied += 1
            print(f"  ok  {path.name} ({len(statements)} statement(s))")
    engine.dispose()
    print(f"Done: {applied} migration file(s) applied.")
    return applied


if __name__ == "__main__":
    apply_migrations()
