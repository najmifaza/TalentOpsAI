"""Seed initial admin/recruiter user and default Job Description for TalentOps AI."""
import json
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.app.core.config import settings


def seed_initial_data():
    engine = create_engine(settings.SYNC_DATABASE_URL, isolation_level="AUTOCOMMIT")

    with engine.connect() as conn:
        print("Checking existing seed data...")

        # 1. Seed Default User (Recruiter / Admin)
        # Pre-hashed password for demo: 'AdminSecret2026!'
        # Using a standard dummy argon2id hash representation
        dummy_argon_hash = "$argon2id$v=19$m=65536,t=3,p=4$dGFsZW50b3BzX3NhbHQ$demo_hash_placeholder_2026"
        
        user_query = text("""
            INSERT INTO users (id, username, email, password_hash, role)
            VALUES (1, 'recruiter_talentops', 'recruiter@talentops.ai', :pwd_hash, 'recruiter')
            ON DUPLICATE KEY UPDATE email = VALUES(email);
        """)
        conn.execute(user_query, {"pwd_hash": dummy_argon_hash})
        print("User seed: recruiter_talentops (ID: 1) created/verified.")

        # 2. Seed Default Job Description (Target benchmark role)
        core_competencies = json.dumps(["FastAPI", "Docker", "MariaDB", "PostgreSQL", "CI/CD", "Redis"])
        weight_config = json.dumps({"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2})
        flagged_ambiguities = json.dumps([])
        raw_jd = (
            "Kami mencari Senior Backend Engineer yang bertanggung jawab membangun arsitektur microservices "
            "berkinerja tinggi, asynchronous event streaming, integrasi basis data relasional ACID, "
            "dan kepatuhan privasi data. Kualifikasi utama: FastAPI, Docker, MariaDB/PostgreSQL, "
            "pemahaman REST API v3, serta praktik CI/CD modern."
        )

        job_query = text("""
            INSERT INTO job_descriptions (id, owner_id, title, department, raw_text, core_competencies, flagged_ambiguities, weight_config, status)
            VALUES (1, 1, 'Senior Backend Engineer', 'Core Engineering', :raw_text, :competencies, :ambiguities, :weights, 'active')
            ON DUPLICATE KEY UPDATE 
                title = VALUES(title),
                department = VALUES(department),
                raw_text = VALUES(raw_text),
                core_competencies = VALUES(core_competencies),
                weight_config = VALUES(weight_config);
        """)
        conn.execute(job_query, {
            "raw_text": raw_jd,
            "competencies": core_competencies,
            "ambiguities": flagged_ambiguities,
            "weights": weight_config,
        })
        print("Job Description seed: Senior Backend Engineer (ID: 1) created/verified.")

        # 3. Verify counts
        users_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
        jobs_count = conn.execute(text("SELECT COUNT(*) FROM job_descriptions")).scalar()
        print(f"Total Users: {users_count}, Total Jobs: {jobs_count}")


if __name__ == "__main__":
    seed_initial_data()
