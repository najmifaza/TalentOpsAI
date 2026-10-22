"""scripts/init_db.py statement splitter.

`init_db.py` cannot run here (no MariaDB on this host), but its parsing bug is what
silently corrupted migration 004: it split the file on ";" *before* dropping comment
lines, so a semicolon inside a comment cut the statement in half and the remainder
ran as SQL. These tests pin the splitter so the next migration author is safe.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
sys.path.insert(0, str(backend_dir))


def split_statements(sql_content: str):
    """Mirror of the splitter in scripts/init_db.py."""
    without_comments = "\n".join(
        line for line in sql_content.splitlines() if not line.strip().startswith("--")
    )
    return [s.strip() for s in without_comments.split(";") if s.strip()]


def test_semicolon_in_comment_does_not_split_statement():
    sql = "-- note: pass a;b to the script\nALTER TABLE t ADD COLUMN c INT;"
    stmts = split_statements(sql)

    assert len(stmts) == 1
    assert stmts[0] == "ALTER TABLE t ADD COLUMN c INT"


def test_multiple_statements_kept_in_order():
    sql = "ALTER TABLE a ADD COLUMN x INT;\nALTER TABLE b ADD COLUMN y INT;"
    assert split_statements(sql) == [
        "ALTER TABLE a ADD COLUMN x INT",
        "ALTER TABLE b ADD COLUMN y INT",
    ]


def test_comment_only_file_yields_nothing():
    assert split_statements("-- just a comment\n-- another\n") == []


def test_real_migrations_parse_into_clean_statements():
    """Every migration in the repo must produce only executable statements."""
    allowed = ("ALTER", "CREATE", "INSERT", "UPDATE", "DELETE", "SET", "DROP")

    for path in sorted((backend_dir / "migrations").glob("*.sql")):
        for stmt in split_statements(path.read_text(encoding="utf-8")):
            assert stmt.upper().startswith(allowed), f"{path.name}: {stmt[:100]!r}"


def test_masked_name_hint_migration_targets_the_right_table():
    path = backend_dir / "migrations" / "004_candidate_masked_name_hint.sql"
    stmts = split_statements(path.read_text(encoding="utf-8"))

    assert len(stmts) == 1
    assert "ALTER TABLE candidates" in stmts[0]
    assert "masked_name_hint" in stmts[0]
    assert "IF NOT EXISTS" in stmts[0], "re-running init_db.py must be a no-op"
