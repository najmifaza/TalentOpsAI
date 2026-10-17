"""Database Initialization & DDL Migration Script for TalentOps AI (MariaDB 12 Tables)."""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.app.core.config import settings


def init_database():
    sql_file = backend_dir / "migrations" / "001_initial_schema.sql"
    if not sql_file.exists():
        print(f"Error: SQL file not found at {sql_file}")
        sys.exit(1)

    print(f"Connecting to database via: {settings.SYNC_DATABASE_URL}")
    engine = create_engine(settings.SYNC_DATABASE_URL, isolation_level="AUTOCOMMIT")

    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    # Split by semicolon, filtering out empty statements and comments
    raw_statements = sql_content.split(";")
    executed = 0

    with engine.connect() as conn:
        for stmt in raw_statements:
            clean_stmt = stmt.strip()
            # Remove leading comments
            lines = [line for line in clean_stmt.splitlines() if not line.strip().startswith("--")]
            clean_stmt = "\n".join(lines).strip()
            if clean_stmt:
                conn.execute(text(clean_stmt))
                executed += 1

    print(f"Successfully executed {executed} DDL statements. 12 tables initialized.")


if __name__ == "__main__":
    init_database()
