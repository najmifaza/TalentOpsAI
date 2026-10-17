-- ==============================================================================
-- TALENTOPS AI: 12 TABEL INTI BASIS DATA RELASIONAL (MARIADB/INNODB ACID)
-- Dokumen Acuan: PRD_TALENTOPS_AI_MASTER.md Bab 7
-- ==============================================================================

-- 1. Manajemen Pengguna & RBAC
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Argon2id
    role ENUM('admin', 'recruiter', 'hiring_manager', 'compliance_officer') NOT NULL,
    failed_logins INT DEFAULT 0,
    locked_until DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Kredensial Integrasi & OAuth
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    provider ENUM('google_calendar', 'greenhouse', 'mock_calendar') NOT NULL,
    encrypted_access_token VARBINARY(512) NOT NULL,
    encrypted_refresh_token VARBINARY(512) NOT NULL,
    token_expiry DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Definisi Lowongan Kerja & Job Intelligence
CREATE TABLE IF NOT EXISTS job_descriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,           -- Recruiter / Admin pemilik lowongan
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    raw_text LONGTEXT NOT NULL,
    core_competencies JSON NOT NULL, -- ["FastAPI", "Docker", "PostgreSQL", "CI/CD", "Redis"]
    flagged_ambiguities JSON NULL,   -- Feedback audit bias deskripsi lowongan
    weight_config JSON NOT NULL,     -- {"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2}
    status ENUM('active', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Data Master Kandidat (Crypto-Shredding & Optimistic Locking)
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    encrypted_name VARBINARY(255) NOT NULL, -- AES-256-GCM via candidate DEK
    encrypted_email VARBINARY(255) NOT NULL, -- AES-256-GCM via candidate DEK (untuk notifikasi izin)
    encrypted_phone VARBINARY(255) NULL,    -- AES-256-GCM via candidate DEK
    encrypted_dek VARBINARY(255) NOT NULL,  -- Data Encryption Key unik terenkripsi Master KEK
    email_blind_index CHAR(64) NULL,        -- Di-overwrite acak saat Right to Erasure
    masked_identifier VARCHAR(64) UNIQUE NOT NULL, -- Display public ID: Format #TK-[6-HEX] (16.7M variasi + retry logic)
    tracking_token CHAR(64) UNIQUE NOT NULL,       -- Token rahasia berentropi tinggi untuk tracking pelamar
    resume_file_path VARCHAR(255) NULL,
    file_hash_sha256 CHAR(64) NULL,         -- Di-nullkan saat Right to Erasure
    github_url VARCHAR(255) NULL,           -- Input opsional pelamar / hasil ekstraksi
    portfolio_url VARCHAR(255) NULL,        -- Input opsional link portofolio
    sanitized_resume_text LONGTEXT NULL,
    dimension_scores JSON NULL,
    overall_score DECIMAL(5,2) NULL,        -- NULL selama queued/analyzing
    confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') NULL,
    unresolved_risk ENUM('LOW', 'MEDIUM', 'HIGH') NULL,
    recommendation ENUM('STRONG_MATCH', 'REVIEW_REQUIRED', 'WEAK_FIT') NULL,
    triage_priority ENUM('HIGH_ATTENTION', 'STANDARD') DEFAULT 'STANDARD',
    status ENUM('queued', 'analyzing', 'waiting_approval', 'approved', 'rejected', 'request_info', 'failed') DEFAULT 'queued',
    is_deleted BOOLEAN DEFAULT FALSE,
    version INT DEFAULT 1,                  -- Optimistic Locking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_candidate_job (job_id),
    INDEX idx_candidate_status (status),
    INDEX idx_candidate_recommendation (recommendation),
    INDEX idx_candidate_blind_email (email_blind_index),
    INDEX idx_candidate_tracking (tracking_token),
    FOREIGN KEY (job_id) REFERENCES job_descriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Rekam Jejak Persetujuan Pemrosesan Data (UU PDP)
CREATE TABLE IF NOT EXISTS consent_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NULL,
    masked_identifier VARCHAR(64) NOT NULL,
    consent_source ENUM('direct_applicant', 'recruiter_legitimate_interest') NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT TRUE,
    consent_hash CHAR(64) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bukti Rekomendasi (Evidence-Based Graph Data)
CREATE TABLE IF NOT EXISTS candidate_evidence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    dimension ENUM('SKILL', 'EXPERIENCE', 'EDUCATION', 'PORTFOLIO') NOT NULL,
    target_competency VARCHAR(100) NULL,
    claim_text TEXT NOT NULL,
    evidence_source TEXT NOT NULL,
    score_contribution DECIMAL(5,2) NOT NULL,
    confidence DECIMAL(3,2) NOT NULL, -- 1.00 (Tier 3), 0.75 (Tier 2), 0.50 (Tier 1)
    INDEX idx_evidence_cand (candidate_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Anomali & Risiko Investigasi Karier
CREATE TABLE IF NOT EXISTS candidate_anomalies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    anomaly_type VARCHAR(100) NOT NULL, -- 'PROMPT_INJECTION', 'OVERLAPPING_DATES', 'TITLE_INFLATION'
    severity ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
    description TEXT NOT NULL,
    suggested_verification TEXT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Soal Asesmen Teknis Adaptif (Gap-based Challenge)
CREATE TABLE IF NOT EXISTS candidate_assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    target_skill VARCHAR(100) NOT NULL,
    difficulty_level ENUM('L1_FUNDAMENTAL', 'L2_SYSTEM_DESIGN', 'L3_EDGE_CASE') NOT NULL,
    scenario_question TEXT NOT NULL,
    evaluation_criteria TEXT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Slot Jadwal Wawancara (Atomic Lock & Anti Double-Booking)
CREATE TABLE IF NOT EXISTS interview_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NULL,
    interviewer_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('available', 'tentative', 'booked') DEFAULT 'available',
    external_calendar_event_id VARCHAR(150) NULL,
    lock_version INT DEFAULT 0,
    tentative_expires_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_interviewer_slot (interviewer_id, start_time),
    INDEX idx_candidate_slots (candidate_id),
    INDEX idx_slot_status_time (status, start_time),
    FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Audit Trail Langkah Siklus Agen (Append-Only)
CREATE TABLE IF NOT EXISTS agent_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    candidate_id INT NULL,
    masked_identifier VARCHAR(64) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    model_id VARCHAR(50) NULL,
    thinking_level VARCHAR(20) NULL,
    status ENUM('started', 'completed', 'failed', 'recovered') NOT NULL,
    payload_input JSON NULL,   -- Hanya menyimpan ID/Hash/Metrik (bukan raw teks resume)
    payload_output JSON NULL,
    error_message TEXT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_run_candidate (run_id, candidate_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Persetujuan Manusia (HITL Decision Records)
CREATE TABLE IF NOT EXISTS human_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    decision ENUM('APPROVED_DISPATCH', 'REQUEST_INFO', 'OVERRIDE_REJECT', 'REJECT_CONFIRMED') NOT NULL,
    notes TEXT NULL,
    version INT DEFAULT 1,                  -- Optimistic Locking
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Log Akses PII (Unmasking Audit - Append-Only)
CREATE TABLE IF NOT EXISTS pii_access_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    candidate_id INT NULL,
    masked_identifier VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pii_user (user_id),
    INDEX idx_pii_cand (candidate_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
