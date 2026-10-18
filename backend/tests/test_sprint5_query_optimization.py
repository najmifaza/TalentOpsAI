"""
Sprint 5 Database Query Optimization & Composite Index Verification Test Suite.
Verifies that DDL migrations apply cleanly and critical queries utilize composite indexes.
"""
import pytest
import sqlite3
from pathlib import Path


@pytest.fixture
def memory_db():
    """Provides an in-memory SQLite database simulating MariaDB schema with SQLite compatibility."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Create base schema adapted for SQLite testing
    cursor.executescript("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE job_descriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            raw_text TEXT NOT NULL,
            core_competencies TEXT NOT NULL,
            weight_config TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            encrypted_name BLOB NOT NULL,
            encrypted_email BLOB NOT NULL,
            encrypted_phone BLOB,
            encrypted_dek BLOB NOT NULL,
            email_blind_index TEXT,
            masked_identifier TEXT UNIQUE NOT NULL,
            tracking_token TEXT UNIQUE NOT NULL,
            resume_file_path TEXT,
            file_hash_sha256 TEXT,
            github_url TEXT,
            portfolio_url TEXT,
            sanitized_resume_text TEXT,
            dimension_scores TEXT,
            overall_score REAL,
            confidence_level TEXT,
            unresolved_risk TEXT,
            recommendation TEXT,
            triage_priority TEXT DEFAULT 'STANDARD',
            status TEXT DEFAULT 'queued',
            is_deleted INTEGER DEFAULT 0,
            version INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE interview_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER,
            interviewer_id INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT DEFAULT 'available',
            external_calendar_event_id TEXT,
            lock_version INTEGER DEFAULT 0,
            tentative_expires_at TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE candidate_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            dimension TEXT NOT NULL,
            target_competency TEXT,
            claim_text TEXT NOT NULL,
            evidence_source TEXT NOT NULL,
            score_contribution REAL NOT NULL,
            confidence REAL NOT NULL
        );

        CREATE TABLE candidate_anomalies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            anomaly_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            description TEXT NOT NULL,
            suggested_verification TEXT NOT NULL
        );

        CREATE TABLE agent_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            candidate_id INTEGER,
            masked_identifier TEXT NOT NULL,
            step_name TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE candidate_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            target_skill TEXT NOT NULL,
            difficulty_level TEXT NOT NULL,
            scenario_question TEXT NOT NULL,
            evaluation_criteria TEXT NOT NULL
        );

        CREATE TABLE pii_access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            candidate_id INTEGER,
            masked_identifier TEXT NOT NULL,
            reason TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE human_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            reviewer_id INTEGER NOT NULL,
            decision TEXT NOT NULL,
            notes TEXT,
            version INTEGER DEFAULT 1,
            reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Apply Sprint 5 Composite Indexes
    migration_file = Path(__file__).resolve().parent.parent / "migrations" / "002_performance_tuning_indexes.sql"
    with open(migration_file, "r", encoding="utf-8") as f:
        sql = f.read()

    # Filter out comments and execute index statements
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        lines = [l for l in stmt.splitlines() if not l.strip().startswith("--")]
        clean = "\n".join(lines).strip()
        if clean:
            cursor.execute(clean)

    conn.commit()
    yield conn
    conn.close()


def test_migrations_file_integrity():
    """Verifies that all migration files exist, are readable, and parse cleanly."""
    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))
    assert len(sql_files) >= 2
    assert (migrations_dir / "001_initial_schema.sql").exists()
    assert (migrations_dir / "002_performance_tuning_indexes.sql").exists()

    with open(migrations_dir / "002_performance_tuning_indexes.sql", "r", encoding="utf-8") as f:
        content = f.read()
        assert "idx_candidates_job_triage_prio" in content
        assert "idx_candidates_eval_ranking" in content
        assert "idx_candidates_batch_queue" in content
        assert "idx_slots_interviewer_overlap" in content
        assert "idx_slots_candidate_active" in content
        assert "idx_evidence_cand_dim" in content
        assert "idx_anomalies_cand_type_sev" in content


def test_explain_query_plan_candidates_dashboard(memory_db):
    """Verifies EXPLAIN QUERY PLAN uses idx_candidates_job_triage_prio for dashboard filter."""
    cursor = memory_db.cursor()

    # Populate dummy rows
    for i in range(100):
        cursor.execute("""
            INSERT INTO candidates (
                job_id, encrypted_name, encrypted_email, encrypted_dek, masked_identifier,
                tracking_token, status, triage_priority, overall_score, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            1 if i % 2 == 0 else 2,
            b"enc", b"enc", b"dek",
            f"#TK-{i:06X}", f"token-{i}",
            "waiting_approval" if i % 3 == 0 else "queued",
            "HIGH_ATTENTION" if i % 5 == 0 else "STANDARD",
            75.0 + (i % 20),
            0
        ))
    memory_db.commit()

    explain_res = cursor.execute("""
        EXPLAIN QUERY PLAN
        SELECT id, masked_identifier, overall_score
        FROM candidates
        WHERE job_id = 1 AND is_deleted = 0 AND status = 'waiting_approval'
        ORDER BY triage_priority DESC, created_at DESC
    """).fetchall()

    plans = [row[3] for row in explain_res]
    assert any("idx_candidates_job_triage_prio" in p for p in plans), f"Plan did not use expected index: {plans}"


def test_explain_query_plan_batch_queue(memory_db):
    """Verifies EXPLAIN QUERY PLAN uses idx_candidates_batch_queue for background triage retrieval."""
    cursor = memory_db.cursor()
    explain_res = cursor.execute("""
        EXPLAIN QUERY PLAN
        SELECT id
        FROM candidates
        WHERE status = 'queued' AND is_deleted = 0
        LIMIT 20
    """).fetchall()

    plans = [row[3] for row in explain_res]
    assert any("idx_candidates_batch_queue" in p for p in plans), f"Plan did not use expected index: {plans}"


def test_explain_query_plan_calendar_overlap(memory_db):
    """Verifies EXPLAIN QUERY PLAN uses idx_slots_interviewer_overlap for atomic overlap checks."""
    cursor = memory_db.cursor()
    explain_res = cursor.execute("""
        EXPLAIN QUERY PLAN
        SELECT id
        FROM interview_slots
        WHERE interviewer_id = 1
          AND status IN ('tentative', 'booked')
          AND start_time < '2026-10-18 11:00:00'
          AND end_time > '2026-10-18 10:00:00'
    """).fetchall()

    plans = [row[3] for row in explain_res]
    assert any("idx_slots_interviewer_overlap" in p for p in plans), f"Plan did not use expected index: {plans}"


def test_explain_query_plan_evidence_and_anomalies(memory_db):
    """Verifies EXPLAIN QUERY PLAN uses composite indexes for candidate evidence and anomalies."""
    cursor = memory_db.cursor()

    ev_plan = cursor.execute("""
        EXPLAIN QUERY PLAN
        SELECT id, claim_text
        FROM candidate_evidence
        WHERE candidate_id = 5 AND dimension = 'SKILL'
    """).fetchall()
    assert any("idx_evidence_cand_dim" in row[3] for row in ev_plan)

    anom_plan = cursor.execute("""
        EXPLAIN QUERY PLAN
        SELECT id, severity
        FROM candidate_anomalies
        WHERE candidate_id = 5 AND anomaly_type = 'PROMPT_INJECTION'
    """).fetchall()
    assert any("idx_anomalies_cand_type_sev" in row[3] for row in anom_plan)
