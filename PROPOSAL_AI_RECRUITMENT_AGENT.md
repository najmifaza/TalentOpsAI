# TalentOps AI: Autonomous Recruitment Operating System
**Sub-title:** *From Resume Screening to Evidence-Based Hiring Decisions*

Dokumen master arsitektur teknis, skema relasional 10 tabel, blueprint MVP lomba, dan kerangka proposal **GTNIC 2026**.

---

## 1. POSITIONING & 5-LAYER SYSTEM BLUEPRINT

Bukan ATS wrapper ChatGPT biasa. Sistem beroperasi sebagai *Autonomous Recruitment Operating System* dengan 5 lapisan hierarki:

```
+-----------------------------------------------------------------------------------+
| 1. DISCOVER LAYER                                                                 |
|    - Autonomous Job Analyzer (Ekstrak kompetensi inti, audit kriteria bias/ambigu)|
|    - Talent Pool Ingestion & PII Sanitizer                                        |
+-----------------------------------------------------------------------------------+
| 2. INVESTIGATION & EVIDENCE LAYER                                                 |
|    - Candidate Claim Verification (Klaim vs Bukti Portofolio/Proyek/Repo)         |
|    - Career Timeline Auditor (Deteksi overlap tanggal, lonjakan fiktif)           |
|    - Fairness Guardian (Eksklusi atribut personal non-job-related terdeteksi)     |
|    - Candidate Evidence Graph (Penelusuran visual sumber bukti per poin skor)     |
|    - Adaptive Technical Challenge (Soal studi kasus berbasis gap kompetensi)      |
+-----------------------------------------------------------------------------------+
| 3. EXECUTION LAYER                                                                |
|    - Autonomous Interview Scheduler (Deteksi bentrok, lock slot atomik DB)        |
|    - Personalized Dispatch Engine (Draf email undangan / klarifikasi)             |
|    - Self-Healing Circuit (Fallback parser, slot collision auto-recovery)         |
+-----------------------------------------------------------------------------------+
| 4. INTELLIGENCE & SIMULATION LAYER                                                |
|    - "What-If?" Hiring Simulator (Simulasi dampak penyesuaian syarat rekrutmen)   |
|    - Candidate-to-Role Risk & Ramp-up Cost Analysis                              |
+-----------------------------------------------------------------------------------+
| 5. GOVERNANCE & AUDIT LAYER                                                       |
|    - Human-in-the-Loop (HITL) Gatekeeper (High/Low confidence triaging)           |
|    - Granular Audit Trail (10 tabel relasional MariaDB + tool call logging)       |
+-----------------------------------------------------------------------------------+
```

---

## 2. FILOSOFI REKAYASA SISTEM: LLM VS DETERMINISTIC BACKEND

* **LLM Engine (9Router / Gemini Flash):** Dibatasi hanya untuk tugas probabilitis: reasoning konteks, planning langkah investigasi, ekstraksi klaim, klasifikasi ambiguitas, dan pembuatan studi kasus adaptif.
* **Deterministic Backend (Python / FastAPI / MariaDB):** Mengontrol seluruh kalkulasi matematika skor, transaksi ACID database, locking slot kalender, validasi skema Pydantic, autentikasi, dan pencatatan audit trail.

---

## 3. ARSITEKTUR TEKNIS (3-TIER BLUEPRINT)

```
[CLIENT LAYER]
React 18 + Vite 5 + Tailwind CSS + Lucide Icons
- UI: Job Analyzer, Drag-Drop CV, Live Execution Trace, Evidence Graph, What-If Simulator
- Host: Vercel Global Edge Network

                | HTTPS REST API + Server-Sent Events (SSE)
                v

[AGENT CORE & BACKEND ENGINE LAYER]
Python 3.12 + FastAPI Core + Pydantic v2 + aiomysql
- Custom Agentic State Machine with ReAct-inspired Tool Orchestration
  (Understand -> Sanitize -> Investigate -> Evidence Fusion -> 4D Score -> Challenge -> Schedule -> HITL)
- Bounded Self-Healing Circuit:
  * Transient Error (Timeout/Deadlock): Exponential backoff retry <= 3
  * Resource Conflict (HTTP 409): Alternative strategy (next slot)
  * Permanent Error (Auth/Format): Immediate human escalation
- Host: Ubuntu VPS, Nginx Reverse Proxy, Let's Encrypt SSL

        | Local TCP (Port 20128)        | aiomysql Pool
        v                               v

[AI INFERENCE]                  [DATA PERSISTENCE & AUDIT]
9Router Gateway                 MariaDB 10.x Enterprise RDBMS
Model: ag/gemini-3.7-flash      10 Tabel Relasional Lengkap
- Strict JSON Schema Output     Audit trail per aksi tool & langkah agen
- Multi-turn function calls
```

---

## 4. SKEMA LENGKAP BASIS DATA MARIADB (10 TABEL)

```sql
-- 1. Definisi Lowongan Kerja & Job Intelligence
CREATE TABLE job_descriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    raw_text LONGTEXT NOT NULL,
    core_competencies JSON NOT NULL,
    flagged_ambiguities JSON NULL,
    weight_config JSON NOT NULL,
    status ENUM('active', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Data Kandidat (4-Dimensional Evaluation Profile)
CREATE TABLE candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    masked_identifier VARCHAR(64) NOT NULL,
    resume_file_path VARCHAR(255) NOT NULL,
    overall_score DECIMAL(5,2) DEFAULT 0.00,
    confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'HIGH',
    unresolved_risk ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'LOW',
    recommendation ENUM('STRONG_MATCH', 'REVIEW_REQUIRED', 'WEAK_FIT') DEFAULT 'REVIEW_REQUIRED',
    status ENUM('analyzing', 'waiting_approval', 'approved', 'rejected') DEFAULT 'analyzing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_descriptions(id) ON DELETE CASCADE
);

-- 3. Bukti Rekomendasi (Evidence-Based Traceability & Graph)
CREATE TABLE candidate_evidence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    dimension ENUM('SKILL', 'EXPERIENCE', 'EDUCATION', 'PORTFOLIO') NOT NULL,
    claim_text TEXT NOT NULL,
    evidence_source TEXT NOT NULL, -- e.g. 'CV Page 2', 'GitHub: Repo Payment'
    score_contribution DECIMAL(5,2) NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- 4. Anomali & Risiko Investigasi
CREATE TABLE candidate_anomalies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    anomaly_type VARCHAR(100) NOT NULL, -- 'timeline_overlap', 'title_inflation', 'gap'
    severity ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
    description TEXT NOT NULL,
    suggested_verification TEXT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- 5. Soal Asesmen Adaptif (Gap-based)
CREATE TABLE candidate_assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    target_skill VARCHAR(100) NOT NULL,
    difficulty_level ENUM('L1_FUNDAMENTAL', 'L2_SYSTEM_DESIGN', 'L3_EDGE_CASE') NOT NULL,
    scenario_question TEXT NOT NULL,
    evaluation_criteria TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- 6. Slot Jadwal Wawancara (Mock Calendar Integration)
CREATE TABLE interview_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NULL,
    interviewer_name VARCHAR(100) NOT NULL,
    scheduled_time DATETIME NOT NULL,
    status ENUM('available', 'tentative', 'booked') DEFAULT 'available',
    meeting_link VARCHAR(255),
    lock_version INT DEFAULT 0
);

-- 7. Audit Trail Langkah Siklus Agen
CREATE TABLE agent_steps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    candidate_id INT NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    status ENUM('started', 'completed', 'failed', 'recovered') NOT NULL,
    payload_input JSON,
    payload_output JSON,
    error_message TEXT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_run_step (run_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- 8. Log Eksekusi Tool Calling (Rubrik Penilaian GTNIC 15%)
CREATE TABLE tool_call_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    input_params JSON,
    output_result JSON,
    status ENUM('SUCCESS', 'FAILED', 'RECOVERED') NOT NULL,
    execution_time_ms INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_run_tool (run_id)
);

-- 9. Persetujuan Manusia (Human-In-The-Loop)
CREATE TABLE human_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    reviewer_name VARCHAR(100) NOT NULL,
    decision ENUM('APPROVED_DISPATCH', 'REQUEST_INFO', 'OVERRIDE_REJECT') NOT NULL,
    notes TEXT,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- 10. Log Simulasi Kebijakan What-If
CREATE TABLE simulation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    scenario_name VARCHAR(150) NOT NULL,
    modified_parameters JSON NOT NULL,
    impact_metrics JSON NOT NULL,
    simulated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_descriptions(id) ON DELETE CASCADE
);
```

---

## 5. SKENARIO 3 KANDIDAT VIDEO DEMO (3–5 MENIT)

Struktur naratif video pengujian:

### Hook Pembuka (00:00 - 00:45)
* *"500 CV masuk dalam 3 hari. Tim HR butuh 66+ jam kerja manual. Pada CV ke-237 tertulis: 5 tahun pengalaman backend engineer. Benarkah klaim tersebut? Atau sekadar tumpang tindih tanggal fiktif yang terlewat karena HR kelelahan? TalentOps AI hadir bukan hanya membaca CV, melainkan menyelidiki bukti, menguji keabsahan klaim, merekomendasikan asesmen adaptif, dan memulihkan kegagalan sistem secara mandiri dengan kontrol akhir tetap di tangan manusia."*

### Breakdown 3 Kasus Kandidat:
1. **Kandidat A: Budi Santoso (Strong Match)**
   * Profil: Senior Backend Engineer (5 thn). Python, FastAPI, Docker, PostgreSQL terbukti dari riwayat proyek.
   * Investigasi: Klaim terverifikasi, anomali nihil (Risk: LOW). Skor: 92.4.
   * Aksi Agen: Reservasi slot kalender tentative, siapkan draf email undangan wawancara.
   * Rekomendasi: `STRONG MATCH -> SHORTLIST (Pending HR Approval)`.
2. **Kandidat B: Reza Pratama (Review Required - Showstopper)**
   * Profil: Senior Backend Engineer (Klaim 5 thn).
   * Temuan Investigatif: Overlap tanggal kerja 17 bulan (PT Alfa Mei 2022–Juni 2024 vs PT Beta Jan 2023–Sekarang).
   * Fitur Evidence Graph: HR klik skor -> Muncul rincian anomali medium severity.
   * Asesmen Adaptif: Dibuatkan soal studi kasus concurrency & race conditions.
   * Rekomendasi: `REVIEW REQUIRED -> HUMAN VERIFICATION`.
3. **Kandidat C: Citra Lestari (Weak Fit)**
   * Profil: Graphic Designer (3 thn). Portfolio Figma & Adobe Illustrator.
   * Temuan Investigatif: Tidak ada anomali terdeteksi, namun bukti relevansi peran sangat rendah (*Insufficient role-relevant evidence*). Skor: 14.5.
   * Rekomendasi: `WEAK FIT -> ARCHIVE (Pending HR Confirmation)`.

### Skenario Self-Healing Recovery:
* Agen mencoba mengunci slot interview 101 untuk Budi -> Server simulasi melempar `HTTP 409 Conflict: Slot Locked`.
* Agen menangkap pesan error -> State Machine mengeksekusi recovery branch -> Query slot alternatif (Slot 102) -> Sukses dikunci -> Log mencatat status: `[RECOVERED]`.

### Skenario What-If Simulator:
* HR menguji kebijakan: toggle *"Hilangkan Syarat Minimal Gelar S1"*.
* Agen mengolah data simulasi seketika: kandidat memenuhi syarat naik +24%, workload HR naik +15%, rata-rata skor teknis stabil di 86%.

---

## 6. PENYESUAIAN FORMAT PROPOSAL (MAKSIMAL 15 HALAMAN A4 TNR 12 SPASI 1.5)
*Sesuai ketentuan silabus Guidebook GTNIC 2026 Halaman 9:*

* **Cover:** Judul karya, nama tim, logo resmi GTNIC 2026. (1 Hal)
* **BAB 1: Latar Belakang Masalah Operasional Enterprise:** Inefisiensi review manual, masalah kelelahan HR, kegagalan ATS statis, urgensi fair hiring & compliance. (2 Hal)
* **BAB 2: Tujuan, Manfaat, & Solusi Otomatisasi AI Agent:** Konsep *Recruitment Operating System*, prinsip *Intelligence over Decision Maker*, transparansi investigasi. (1 Hal)
* **BAB 3: Target Perusahaan & Analisis Pengguna Industri:** Divisi Talent Acquisition, VP of Engineering, HR Compliance Officer. (1 Hal)
* **BAB 4: Arsitektur Sistem AI & Rekayasa Perangkat Lunak:**
  - Diagram 3-Tier (React Vercel, FastAPI VPS, MariaDB, 9Router).
  - Custom Agentic State Machine with ReAct-inspired Tool Orchestration.
  - Skema MariaDB 10 tabel relasional & pemisahan layanan What-If Simulator. (3 Hal)
* **BAB 5: Fitur Utama AI Agent & Estimasi Metrik Efisiensi Operasional (ROI):** Waktu review 8 menit -> 12 detik (Efisiensi 97.5%), Evidence Scoring, Adaptive Challenge, What-If Simulator. (2 Hal)
* **BAB 6: Batasan Sistem & Mitigasi Risiko:** PII sanitization, evaluasi berbasis job-relevant evidence (Fairness Guardian), mitigasi halusinasi via deterministic calculation & strict JSON, bounded self-healing. (2 Hal)
* **BAB 7: Desain Antarmuka & Interaksi Pengguna:** Tangkapan layar antarmuka web, tampilan Execution Trace feed, visual modal Candidate Evidence Graph, What-If visual matrix. (2 Hal)
* **BAB 8: Rencana Pengembangan Lanjutan (Future Development):** Multi-Agent Interview Panel, Internal Talent Mobility, Hiring Forecast. (1 Hal)
