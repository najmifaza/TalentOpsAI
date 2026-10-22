"""Seed initial admin/recruiter user and default Job Description for TalentOps AI."""
import json
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))
# Also expose the package as `app.*`: core modules import each other that way
# (`from app.core.config import settings`), so `backend.*` alone breaks the import chain.
sys.path.insert(0, str(backend_dir))

from app.core.config import settings

# Dev-only fallback. Production must supply SEED_ADMIN_PASSWORD.
DEFAULT_SEED_PASSWORD = "AdminSecret2026!"

# password_hash is rewritten on conflict on purpose: a stale legacy hash (e.g.
# argon2id) makes verify_password fail forever, leaving the account unloggable.
USER_SEED_SQL = """
    INSERT INTO users (id, username, email, password_hash, role)
    VALUES (1, 'recruiter_talentops', 'recruiter@talentops.ai', :pwd_hash, 'recruiter')
    ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        password_hash = VALUES(password_hash);
"""


def resolve_seed_password() -> str:
    """Password to seed with: SEED_ADMIN_PASSWORD wins, repo default is the dev fallback."""
    override = os.getenv("SEED_ADMIN_PASSWORD")
    if override:
        return override
    print(
        "WARNING: SEED_ADMIN_PASSWORD is not set; using the public default "
        "password from the repository. Set it before seeding a production DB."
    )
    return DEFAULT_SEED_PASSWORD


def seed_initial_data():
    engine = create_engine(settings.SYNC_DATABASE_URL, isolation_level="AUTOCOMMIT")

    with engine.connect() as conn:
        print("Checking existing seed data...")

        # 1. Seed Default User (Recruiter / Admin)
        # PBKDF2-HMAC-SHA256 (stdlib, no native argon2 dep).
        from app.core.auth import hash_password

        pwd_hash = hash_password(resolve_seed_password())

        conn.execute(text(USER_SEED_SQL), {"pwd_hash": pwd_hash})
        print("User seed: recruiter_talentops (ID: 1) created/verified.")

        # 2. Seed Default Job Description (Target benchmark role)
        core_competencies = json.dumps(["FastAPI", "Docker", "MariaDB", "PostgreSQL", "CI/CD", "Redis"])
        weight_config = json.dumps({"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2})
        # NULL, bukan "[]": portal publik membedakan "belum pernah diaudit"
        # (NULL) dari "sudah diaudit, nol temuan" ([]). Menulis [] di sini membuat
        # lowongan tampil seolah lulus audit dengan skor 100.
        flagged_ambiguities = None
        # raw_text is the triage input: it must keep reading like a real posting.
        raw_jd = (
            "Kami mencari Senior Backend Engineer yang bertanggung jawab membangun arsitektur microservices "
            "berkinerja tinggi, asynchronous event streaming, integrasi basis data relasional ACID, "
            "dan kepatuhan privasi data. Kualifikasi utama: FastAPI, Docker, MariaDB/PostgreSQL, "
            "pemahaman REST API v3, serta praktik CI/CD modern."
        )

        # Public-facing copy. Kept separate from raw_text so editing the portal
        # wording never changes what the scoring engine reads.
        description_text = (
            "Merancang dan memelihara layanan backend berbasis FastAPI dengan arsitektur microservices "
            "yang melayani trafik tinggi.\n"
            "Membangun pipeline event streaming asynchronous untuk pemrosesan data near real-time.\n"
            "Mengelola skema dan query basis data relasional ACID pada MariaDB/PostgreSQL.\n"
            "Menegakkan kepatuhan privasi data pada setiap lapisan layanan sesuai UU PDP No. 27/2022.\n"
            "Menjaga kualitas rilis melalui otomasi CI/CD dan pengujian regresi."
        )
        requirements_text = (
            "Pendidikan minimal S1 Informatika, Ilmu Komputer, atau bidang terkait.\n"
            "Pengalaman minimal 3 tahun membangun layanan backend produksi.\n"
            "Menguasai Python dan FastAPI, termasuk asynchronous I/O.\n"
            "Terbiasa dengan Docker, orkestrasi container, dan pipeline CI/CD.\n"
            "Memahami perancangan basis data relasional dan optimasi query.\n"
            "Bersedia bekerja hibrida dari Jakarta Selatan."
        )

        job_query = text("""
            INSERT INTO job_descriptions (
                id, owner_id, title, department, raw_text, core_competencies,
                flagged_ambiguities, weight_config, status,
                company_name, company_logo_url, company_about, company_address,
                company_industry, company_website, job_function, employment_level,
                location, deadline, description_text, requirements_text
            )
            VALUES (
                1, 1, 'Senior Backend Engineer', 'Core Engineering', :raw_text, :competencies,
                :ambiguities, :weights, 'active',
                :company_name, :company_logo_url, :company_about, :company_address,
                :company_industry, :company_website, :job_function, :employment_level,
                :location, :deadline, :description_text, :requirements_text
            )
            ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                department = VALUES(department),
                raw_text = VALUES(raw_text),
                core_competencies = VALUES(core_competencies),
                weight_config = VALUES(weight_config),
                company_name = VALUES(company_name),
                company_logo_url = VALUES(company_logo_url),
                company_about = VALUES(company_about),
                company_address = VALUES(company_address),
                company_industry = VALUES(company_industry),
                company_website = VALUES(company_website),
                job_function = VALUES(job_function),
                employment_level = VALUES(employment_level),
                location = VALUES(location),
                deadline = VALUES(deadline),
                description_text = VALUES(description_text),
                requirements_text = VALUES(requirements_text);
        """)
        conn.execute(job_query, {
            "raw_text": raw_jd,
            "competencies": core_competencies,
            "ambiguities": flagged_ambiguities,
            "weights": weight_config,
            "company_name": "TalentOps AI",
            "company_logo_url": None,
            "company_about": (
                "TalentOps AI membangun ekosistem seleksi kerja berbasis agen AI otonom dengan "
                "penyensoran identitas dua arah dan audit bukti yang dapat ditelusuri."
            ),
            "company_address": "Jl. Prof. Dr. HR Boenyamin No. 708, Purwokerto, Jawa Tengah 53122",
            "company_industry": "Teknologi Informasi",
            "company_website": "https://talentops.ai.id",
            "job_function": "Engineering",
            "employment_level": "Profesional",
            "location": "Jakarta Selatan (Hibrida)",
            "deadline": "2026-12-31",
            "description_text": description_text,
            "requirements_text": requirements_text,
        })
        print("Job Description seed: Senior Backend Engineer (ID: 1) created/verified.")

        # 3. Verify counts
        users_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
        jobs_count = conn.execute(text("SELECT COUNT(*) FROM job_descriptions")).scalar()
        print(f"Total Users: {users_count}, Total Jobs: {jobs_count}")


if __name__ == "__main__":
    seed_initial_data()
