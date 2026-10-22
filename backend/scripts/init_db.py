"""Database Initialization & DDL Migration Script for TalentOps AI (MariaDB 12 Tables)."""
import os
import re
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.app.core.config import settings


def _mask_dsn(dsn: str) -> str:
    """Never print the DB password: this output lands in shell history and journald."""
    return re.sub(r"(://[^:/@]+:)[^@]*@", r"\1***@", dsn)


def init_database():
    migrations_dir = backend_dir / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))
    if not sql_files:
        print(f"Error: No SQL files found in {migrations_dir}")
        sys.exit(1)

    print(f"Connecting to database via: {_mask_dsn(settings.SYNC_DATABASE_URL)}")
    engine = create_engine(settings.SYNC_DATABASE_URL, isolation_level="AUTOCOMMIT")

    total_executed = 0
    with engine.connect() as conn:
        for sql_file in sql_files:
            print(f"Executing migration: {sql_file.name}")
            with open(sql_file, "r", encoding="utf-8") as f:
                sql_content = f.read()

            # Strip full-line comments BEFORE splitting on ";" — a semicolon inside
            # a comment used to cut the statement in half and leave the remainder
            # to run as SQL.
            without_comments = "\n".join(
                line for line in sql_content.splitlines() if not line.strip().startswith("--")
            )
            raw_statements = without_comments.split(";")
            file_executed = 0
            for stmt in raw_statements:
                clean_stmt = stmt.strip()
                if clean_stmt:
                    conn.execute(text(clean_stmt))
                    file_executed += 1
            print(f"  -> {file_executed} statements executed from {sql_file.name}")
            total_executed += file_executed

    print(f"Successfully executed {total_executed} total DDL statements across {len(sql_files)} migrations.")


if __name__ == "__main__":
    init_database()
