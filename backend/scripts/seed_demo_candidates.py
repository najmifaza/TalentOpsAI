"""Seeds 5 demo candidates into MariaDB/InnoDB for What-If Studio and live UI demo."""
import json
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.crypto import generate_dek, encrypt_dek, encrypt_pii, compute_blind_index
from app.core.llm_adapter import compute_file_hash
from app.core.scoring import DeterministicScoringEngine

DATASET_DIR = backend_dir / "data" / "golden_dataset"

DEMO_PROFILES = [
    {
        "id": 1,
        "filename": "cv_01_budi_santoso.txt",
        "name": "Budi Santoso",
        "email": "budi.santoso@email.com",
        "phone": "+6281234567890",
        "masked_id": "#TK-A17C9B",
        "token": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "claims": [
            {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "built async rest microservices using FastAPI handling 2500 rps", "metric_string": "2500 rps", "repo_url": "https://github.com/candidate/payment-service"},
            {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True, "context_narrative": "reduced database query latency by 40% using composite indexing", "metric_string": "40% latency reduction"},
            {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True, "context_narrative": "containerized services with Docker"},
            {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True, "context_narrative": "full CI/CD pipeline", "repo_url": "https://github.com/candidate/payment-service"},
            {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True, "context_narrative": "async REST with Redis"},
        ],
        "timeline": [{"role": "Senior Backend", "start": "2019-01", "end": "present", "is_relevant_role": True}],
        "education": {"degree": "S1", "field_of_study": "Informatika"},
        "anomalies": {},
        "repos": {"https://github.com/candidate/payment-service": {"verified": True, "is_fork": False, "stars_count": 25}},
    },
    {
        "id": 2,
        "filename": "cv_02_reza_pratama.txt",
        "name": "Reza Pratama",
        "email": "reza.pratama@email.com",
        "phone": "+6281298765432",
        "masked_id": "#TK-B82F10",
        "token": "d41d8cd9-8f00-4b82-9a3b-231a48c6a012",
        "claims": [
            {"dimension": "SKILL", "technology": "FastAPI", "has_implementation_detail": True, "context_narrative": "distributed microservices serving 1000000 users", "metric_string": "1000000 users"},
            {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True, "context_narrative": "relational database schemas in PostgreSQL"},
            {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True, "context_narrative": "containerized deployments"},
            {"dimension": "SKILL", "technology": "Redis", "has_implementation_detail": True, "context_narrative": "cached order states"},
            {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True, "context_narrative": "continuous integration workflows"},
        ],
        "timeline": [
            {"role": "Lead Architect", "start": "2020-01", "end": "2023-06", "employment_type": "full_time", "is_relevant_role": True},
            {"role": "Backend Specialist", "start": "2022-01", "end": "2024-05", "employment_type": "full_time", "is_relevant_role": True},
        ],
        "education": {"degree": "S1", "field_of_study": "Sistem Informasi"},
        "anomalies": {},
        "repos": {"https://github.com/reza/order-service": {"verified": True, "is_fork": False, "stars_count": 12}},
    },
    {
        "id": 3,
        "filename": "cv_03_citra_lestari.txt",
        "name": "Citra Lestari",
        "email": "citra.lestari@email.com",
        "phone": "+6281311223344",
        "masked_id": "#TK-C39D44",
        "token": "202cb962-ac59-4d96-9328-2d52402d08a0",
        "claims": [
            {"dimension": "SKILL", "technology": "Adobe Illustrator", "has_implementation_detail": True},
            {"dimension": "SKILL", "technology": "Photoshop", "has_implementation_detail": True},
        ],
        "timeline": [{"role": "Brand Designer", "start": "2021-01", "end": "present", "is_relevant_role": False}],
        "education": {"degree": "S1", "field_of_study": "Desain Komunikasi Visual"},
        "anomalies": {},
        "repos": {},
    },
    {
        "id": 4,
        "filename": "cv_04_dewi_sartika.txt",
        "name": "Dewi Sartika",
        "email": "dewi.sartika@email.com",
        "phone": "+6281788990011",
        "masked_id": "#TK-D99A12",
        "token": "c4ca4238-a0b9-4ae8-b221-0b3b22911234",
        "claims": [
            {"dimension": "SKILL", "technology": "Python", "has_implementation_detail": True, "context_narrative": "developed internal inventory dashboard"},
            {"dimension": "SKILL", "technology": "SQLite", "has_implementation_detail": True},
        ],
        "timeline": [{"role": "Python Web Developer", "start": "2022-02", "end": "present", "is_relevant_role": True}],
        "education": {"degree": "D3", "field_of_study": "Manajemen Informatika"},
        "anomalies": {"prompt_injection_detected": True, "hidden_text_detected": True},
        "repos": {},
    },
    {
        "id": 5,
        "filename": "cv_05_eko_prasetyo.txt",
        "name": "Eko Prasetyo",
        "email": "eko.prasetyo@email.com",
        "phone": "+6281566778899",
        "masked_id": "#TK-E55F88",
        "token": "eccbc87e-4b5ce2fe-28308fd9f2a7baf3",
        "claims": [
            {"dimension": "SKILL", "technology": "Go", "has_implementation_detail": True, "context_narrative": "engineered data ingestion pipelines in Go processing 10k messages", "metric_string": "10k messages per minute"},
            {"dimension": "SKILL", "technology": "PostgreSQL", "has_implementation_detail": True, "context_narrative": "transactional database operations in PostgreSQL"},
            {"dimension": "SKILL", "technology": "Docker", "has_implementation_detail": True, "context_narrative": "Docker"},
            {"dimension": "SKILL", "technology": "Kafka", "has_implementation_detail": True, "context_narrative": "Apache Kafka"},
            {"dimension": "SKILL", "technology": "CI/CD", "has_implementation_detail": True, "context_narrative": "CI/CD"},
        ],
        "timeline": [
            {"role": "Mid Backend Developer", "start": "2023-03", "end": "present", "is_relevant_role": True},
            {"role": "Family Care & Elder Support", "start": "2021-09", "end": "2023-02", "is_relevant_role": False},
            {"role": "Backend Engineer", "start": "2018-03", "end": "2021-08", "is_relevant_role": True},
        ],
        "education": {"degree": "S1", "field_of_study": "Teknik Komputer"},
        "anomalies": {"career_break_detected": True},
        "repos": {"https://github.com/candidate/payment-service": {"verified": True, "is_fork": False}},
    },
]


def seed_candidates():
    engine = create_engine(settings.SYNC_DATABASE_URL, isolation_level="AUTOCOMMIT")
    core_competencies = ["FastAPI", "Docker", "MariaDB", "PostgreSQL", "CI/CD", "Redis"]

    with engine.connect() as conn:
        print("Seeding 5 demo candidates into MariaDB...")
        for p in DEMO_PROFILES:
            txt_path = DATASET_DIR / p["filename"]
            raw_text = ""
            if txt_path.exists():
                with open(txt_path, "r", encoding="utf-8") as f:
                    raw_text = f.read()

            file_hash = compute_file_hash(raw_text)
            dek = generate_dek()
            enc_dek = encrypt_dek(dek)
            enc_name = encrypt_pii(p["name"], dek)
            enc_email = encrypt_pii(p["email"], dek)
            enc_phone = encrypt_pii(p["phone"], dek)
            blind_idx = compute_blind_index(p["email"])

            assessment = DeterministicScoringEngine.compute_full_assessment(
                claims=p["claims"],
                career_timeline=p["timeline"],
                education=p["education"],
                anomalies=p["anomalies"],
                core_competencies=core_competencies,
                verified_repos=p["repos"],
            )

            insert_query = text("""
                INSERT INTO candidates (
                    id, job_id, encrypted_name, encrypted_email, encrypted_phone, encrypted_dek,
                    email_blind_index, masked_identifier, tracking_token, resume_file_path,
                    file_hash_sha256, sanitized_resume_text, dimension_scores, overall_score,
                    confidence_level, unresolved_risk, recommendation, triage_priority,
                    status, is_deleted, version
                ) VALUES (
                    :id, 1, :enc_name, :enc_email, :enc_phone, :enc_dek,
                    :blind_idx, :masked_id, :token, :filename,
                    :file_hash, :raw_text, :dims, :overall,
                    :conf, :risk, :rec, :prio,
                    'waiting_approval', FALSE, 1
                )
                ON DUPLICATE KEY UPDATE
                    dimension_scores = VALUES(dimension_scores),
                    overall_score = VALUES(overall_score),
                    confidence_level = VALUES(confidence_level),
                    unresolved_risk = VALUES(unresolved_risk),
                    recommendation = VALUES(recommendation),
                    triage_priority = VALUES(triage_priority),
                    sanitized_resume_text = VALUES(sanitized_resume_text);
            """)

            conn.execute(insert_query, {
                "id": p["id"],
                "enc_name": enc_name,
                "enc_email": enc_email,
                "enc_phone": enc_phone,
                "enc_dek": enc_dek,
                "blind_idx": blind_idx,
                "masked_id": p["masked_id"],
                "token": p["token"],
                "filename": p["filename"],
                "file_hash": file_hash,
                "raw_text": raw_text,
                "dims": json.dumps(assessment["dimension_scores"]),
                "overall": assessment["overall_score"],
                "conf": assessment["confidence_level"],
                "risk": assessment["unresolved_risk"],
                "rec": assessment["recommendation"],
                "prio": assessment["triage_priority"],
            })

            # Anomalies
            if p["anomalies"].get("prompt_injection_detected"):
                conn.execute(text("""
                    INSERT INTO candidate_anomalies (candidate_id, anomaly_type, severity, description, suggested_verification)
                    VALUES (:cid, 'PROMPT_INJECTION', 'HIGH', 'Detected prompt injection / hidden text.', 'Review file.')
                    ON DUPLICATE KEY UPDATE severity = VALUES(severity);
                """), {"cid": p["id"]})

            print(f"Candidate seeded: {p['name']} ({p['masked_id']}) -> {assessment['overall_score']} [{assessment['recommendation']}]")

        print("Seeding complete.")


if __name__ == "__main__":
    seed_candidates()
