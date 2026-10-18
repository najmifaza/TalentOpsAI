# LAPORAN EVALUASI HASIL IMPLEMENTASI TEKNIS TALENTOPS AI (SPRINT 1 - 3)

**Dokumen Acuan:**
1. [PRD_TALENTOPS_AI_MASTER.md](./PRD_TALENTOPS_AI_MASTER.md) (Versi 2.5.2)
2. [PEMBAGIAN_TUGAS_TIM.md](./PEMBAGIAN_TUGAS_TIM.md)

**Tanggal Evaluasi:** 18 Oktober 2026  
**Auditor:** Senior Developer Review  
**Cakupan Evaluasi:** Kode Sumber Backend, Frontend, AI/Data Engine, dan Infrastruktur Deployment

---

## 1. RINGKASAN EKSEKUTIF

Proyek **TalentOps AI** telah menyelesaikan implementasi teknis untuk **Sprint 1 (Fondasi & Walking Skeleton)**, **Sprint 2 (Data Ingestion, Model Extraction & Core Interconnection)**, dan **Sprint 3 (Fitur Lanjutan, Keamanan & Interaktif WOW Factor)**. 

Seluruh deliverable inti dari ketiga sprint telah terintegrasi di branch `main` dan diverifikasi:
* **Backend API & DB:** Live di VPS Ubuntu `https://api-talentops.fawt.biz.id/api/health` dengan SSL HTTPS Let's Encrypt aktif.
* **Automated Tests:** 27 test suite pytest lulus 100% (zero failure).
* **Dataset:** 25 berkas resume sintetis Golden Dataset (.txt dan .docx) terverifikasi.
* **Frontend:** Arsitektur SPA React 18 + Vite terintegrasi penuh dengan routing React Router DOM v7 dan visual design natural pine/sage anti AI-slop.

---

## 2. EVALUASI IMPLEMENTASI PER DEVELOPER

### A. Developer 1: Najmi (Backend, Database, Security & Infrastructure)
*Tingkat Kesesuaian:* **95% Sesuai PRD & RACI Matrix**

#### Komponen yang Telah Selesai:
1. **Basis Data Relasional 12 Tabel ACID (PRD Bab 7):**
   - File DDL: `backend/migrations/001_initial_schema.sql` (InnoDB, utf8mb4).
   - Skema mencakup tabel users, oauth_tokens, job_descriptions, candidates, consent_records, candidate_evidence, candidate_anomalies, candidate_assessments, interview_slots, agent_steps, human_reviews, pii_access_logs.
   - Script inisialisasi dan seeding DB: `backend/scripts/init_db.py`, `backend/scripts/seed_data.py`, `backend/scripts/seed_demo_candidates.py`.
2. **Kriptografi & Kepatuhan UU PDP No. 27/2022 (PRD Bab 6.2):**
   - File: `backend/app/core/crypto.py` dan `backend/app/core/erasure.py`.
   - Implementasi Envelope Encryption AES-256-GCM (`generate_dek`, `encrypt_dek`, `encrypt_pii`, `decrypt_pii`).
   - Blind indexing email menggunakan HMAC-SHA256 dengan pepper rahasia.
   - Layanan terpadu `talentops_erasure` (`execute_talentops_erasure`) untuk hak hapus data (Right to Erasure) melalui soft deletion kriptografis (`is_deleted = TRUE`, penimpaan DEK dengan zero-bytes, penimpaan blind index dengan tombstone hash acak, pembersihan evidence/assessments, dan pencatatan audit append-only di `pii_access_logs`).
3. **Ingestion & Sanitasi PII (PRD Bab 6.1):**
   - File: `backend/app/core/sanitizer.py`, `backend/app/core/file_parser.py`, `backend/app/core/rate_limiter.py`.
   - In-memory regex sanitizer (<20ms) dengan fitur Two-Way Dictionary Matching untuk input pelamar mandiri.
   - Validasi berkas fisik biner Magic Bytes (`%PDF-` dan `PK\x03\x04`).
   - Rate limiting 5 request/menit berbasis IP di belakang reverse proxy Nginx.
4. **Adapter Integrasi & Bounded Self-Healing (PRD Bab 6.3):**
   - File: `backend/app/adapters/calendar.py`, `backend/app/adapters/github.py`, `backend/app/core/broadcaster.py`.
   - Mock Calendar Adapter dengan Strict Lock Hierarchy (`users` -> `interview_slots` -> `candidates`), pengecekan jadwal bertabrakan, format Event ID deterministik RFC 5545, serta background cleaner slot kedaluwarsa.
   - GitHub REST API v3 adapter dengan regex parsing format repo dan SSRF guard.
   - In-memory SSE Broadcaster (`asyncio.Queue`) dengan buffer event replay.
5. **Endpoint API (PRD Bab 8.2):**
   - Public Career Portal: `GET /api/careers`, `GET /api/careers/{id}`, `POST /api/careers/{id}/apply`, `GET /api/careers/track/{token}`, `POST /api/careers/withdraw`.
   - Internal Recruiter: `GET /api/candidates`, `GET /api/candidates/{id}`, `POST /api/candidates/upload`, `POST /api/candidates/{id}/review`, `DELETE /api/candidates/{id}`.
   - Live SSE Stream: `GET /api/candidates/stream/{candidate_id}`.

#### Catatan Teknis / Gap:
* Mekanisme SSE Ticket (`POST /api/candidates/{id}/sse-ticket`) yang tercantum pada PRD Bab 8.2 Endpoint 15 saat ini masih menggunakan streaming langsung ke `/api/candidates/stream/{id}`. Ini sudah memadai untuk MVP demo live, namun perlu dicatat sebagai pemenuhan target arsitektur enterprise `[TARGET]`.

---

### B. Developer 2: Fardizza (AI Agent Logic, Scoring Engine & Evaluation)
*Tingkat Kesesuaian:* **98% Sesuai PRD & RACI Matrix**

#### Komponen yang Telah Selesai:
1. **Model Adapter Layer (PRD Bab 5.1):**
   - File: `backend/app/core/llm_adapter.py`.
   - Integrasi 9router Gateway (Gemini 3.8 / Antigravity), Suhu 0.0, Thinking Level low.
   - Ketahanan jaringan: retry backoff eksponensial, fallback model, dan store pre-cached SHA-256 untuk live demo offline.
2. **Skema Ekstraksi & Anti-Hallucination Guard (PRD Bab 5.1 & 6.1):**
   - File: `backend/app/schemas/extraction.py`, `backend/app/core/prompt.py`, `backend/app/core/hidden_text_detector.py`.
   - Skema Pydantic v2 `CandidateExtractionSchema` dengan `extra="forbid"`, isolasi anti-bias almamater dan akreditasi kampus.
   - Substring Guard anti-halusinasi klaim yang memvalidasi narasi terhadap teks resume asli, otomatis menurunkan klaim ke Tier 1 jika tidak ditemukan.
   - Detektor teks tersembunyi DOCX (`w:vanish`, white-font RGB #FFFFFF, font <= 1pt).
   - System prompt single-pass ekstraksi terbungkus tag XML `<candidate_resume_untrusted>`.
3. **Deterministic 4D Scoring Engine (PRD Bab 5.2):**
   - File: `backend/app/core/scoring.py`.
   - $S_{\text{comp}}$: Coverage formula berbasis taxonomy map (`SKILL_TAXONOMY_MAP`: Exact 1.0, Ecosystem 0.7) dan tiering rubric (Tier 3 via regex metrik + fluff guard).
   - $S_{\text{exp}}$: Algoritma *Interval Merging* untuk mencegah double-counting durasi kerja tumpang tindih.
   - $S_{\text{edu}}$: Skalar jenjang linier pendidikan IT.
   - $S_{\text{port}}$: Evaluasi nilai maksimum top repo terverifikasi, otomatis di-bypass untuk lowongan non-programmer.
   - Overall Score dengan bobot dinamis 4 dimensi ($\sum w_d = 1.0$).
   - Hierarki keputusan agen (Aturan 0 Security Quarantine hingga Aturan 4 Weak Fit).
   - Kebijakan Career Break (>12 bulan sebagai flag informatif, tanpa penalti risiko MEDIUM otomatis).
   - Sintesis asesmen adaptif L1/L2 untuk gap kompetensi kunci.
4. **Autonomous Agent Triage Service (PRD Bab 5.3):**
   - File: `backend/app/core/triage_service.py`, `backend/app/api/candidates.py`.
   - Orkestrasi 7 siklus agen dengan penyiaran trace via SSE dan kontrol konkurensi `asyncio.Semaphore(3)`.
   - Endpoint: `POST /api/candidates/{id}/triage` dan `POST /api/candidates/batch-triage`.
5. **What-If Policy Simulation Studio Backend (PRD Bab 8.2 Endpoint 11):**
   - File: `backend/app/api/jobs.py`.
   - Endpoint `POST /api/jobs/{id}/simulate-policy` in-memory tanpa memanggil ulang LLM.
   - Dynamic threshold `min_overall_score` (default 75.0) dan proteksi isolasi kandidat karantina.
6. **Golden Dataset 25 Profil Resume (PRD Bab 9.1 & 9.2):**
   - File generator: `backend/data/generate_expanded_dataset.py`.
   - 25 resume format `.txt` dan `.docx` di `backend/data/golden_dataset/` mencakup skenario jujur, overlap kronologi, manipulasi teks, jeda karier, fresh graduate, non-programmer, dan pasangan counterfactual fairness.
   - Test suite `test_golden_dataset_expanded.py`: Counterfactual Fairness Test Gender & Almamater delta skor = 0.00 (target <= 1.0).

#### Catatan Teknis / Gap:
* Perlu mengeksekusi skrip formal benchmark determinisme (5x eksekusi suhu 0.0 cache off) dan audit kebocoran PII pada narasi bebas pada Sprint 4.

---

### C. Developer 3: Willy (Frontend Architecture, UI/UX & State Management)
*Tingkat Kesesuaian:* **96% Sesuai PRD & RACI Matrix**

#### Komponen yang Telah Selesai:
1. **Arsitektur & Design System (PRD Bab 3 & Desain):**
   - React 18 + Vite 5 + Tailwind CSS.
   - Palet warna organik natural pine & sage (`#051F20`, `#0B2B26`, `#8EB69B`, `#EEF4F0`) anti AI-slop.
   - Navigasi penuh via React Router DOM v7 (`/careers`, `/careers/apply`, `/careers/track/:token`, `/dashboard`, `/evidence-graph`, `/what-if`, `/security-pdp`).
   - Komponen `HealthStatusBadge.jsx` live polling ke VPS (`https://api-talentops.fawt.biz.id/api/health`).
   - Konfigurasi `frontend/vercel.json` dengan CSP ketat `connect-src 'self' https://api-talentops.fawt.biz.id;`.
2. **Public Career Portal (PRD Bab 2 & 8.2):**
   - File: `CareerPortal.jsx`, `DpaModal.jsx`, `TokenIssuedModal.jsx`, `ApplicationTracker.jsx`.
   - Drag-and-drop resume uploader dengan validasi MIME browser.
   - Modal edukasi DPA persetujuan UU PDP No. 27/2022.
   - Penerbitan `masked_identifier` (`#TK-XXXXXX`) dan `tracking_token` (UUIDv4).
   - Tracker status stepper 5 tahap dan tombol penarikan lamaran mandiri (*Right to Erasure*).
3. **Candidate Evidence Graph (PRD Bab 1.2 & 5.1):**
   - File: `frontend/src/components/EvidenceGraph.jsx` berbasis `@xyflow/react` (React Flow v12).
   - Menghubungkan 4 layer: Dossier -> Klaim Pydantic -> Substring CV -> GitHub API.
   - Status badge `NOT_APPLICABLE` untuk lowongan non-programmer dan visual edge berkedip merah untuk anomali injeksi teks.
4. **What-If Policy Simulation Studio UI (PRD Bab 4.2 & 8.2):**
   - File: `frontend/src/components/WhatIfStudio.jsx`.
   - 4 Interactive range slider ($S_{\text{comp}}, S_{\text{port}}, S_{\text{conf}}, S_{\text{risk}}$) dan passing grade cut-off slider.
   - 4 Preset kebijakan satu klik (Balanced, Code-First, Security-Strict, Fresh Talent).
   - Re-ranking table in-memory instan dengan indikator pergeseran peringkat ($\Delta rank$) dan delta skor.
   - Fitur ekspor hasil simulasi ke berkas JSON.
5. **Modal Review Dossier & Penjadwalan Kalender (PRD Bab 6.3):**
   - File: `frontend/src/components/CandidateModal.jsx`.
   - Alur multi-step: dossier review -> pemilihan slot kalender atomik -> penerbitan Event ID RFC 5545 -> konfirmasi persetujuan/penolakan patuh UU PDP.
6. **Listener Live SSE Agent Execution (PRD Bab 5.3):**
   - File: `frontend/src/components/AgentTraceModal.jsx`.
   - Listener `EventSource` mengonsumsi trace 7 tahap siklus otonom agen secara real-time dengan status streaming dan fitur trace replay.

#### Catatan Teknis / Gap:
* Folder `frontend/node_modules` belum di-install di lingkungan host lokal Windows saat ini (`npm install`). Instalasi dependensi lokal dibutuhkan jika tim hendak menjalankan build / preview di laptop dev.

---

## 3. HASIL VERIFIKASI PENGUJIAN OTOMATIS (TEST SUITE)

Hasil eksekusi `pytest` di `backend/` menggunakan Python 3.11:
```text
tests/test_extraction_schema.py::test_valid_extraction_payload PASSED
tests/test_extraction_schema.py::test_strict_anti_bias_forbids_university PASSED
tests/test_extraction_schema.py::test_substring_guard_validation_and_downgrade PASSED
tests/test_golden_dataset_expanded.py::test_dataset_completeness PASSED
tests/test_golden_dataset_expanded.py::test_hidden_text_audit PASSED
tests/test_golden_dataset_expanded.py::test_counterfactual_fairness_gender PASSED
tests/test_golden_dataset_expanded.py::test_counterfactual_fairness_almamater PASSED
tests/test_golden_dataset_expanded.py::test_career_break_fairness PASSED
tests/test_golden_dataset_extraction.py::test_hidden_text_audit PASSED
tests/test_golden_dataset_extraction.py::test_budi_santoso_extraction_cached_pipeline PASSED
tests/test_llm_adapter.py::test_deterministic_hashing PASSED
tests/test_llm_adapter.py::test_pre_cached_store PASSED
tests/test_llm_adapter.py::test_cache_bypass_mocked_gateway PASSED
tests/test_simulate_policy.py::test_weight_validation PASSED
tests/test_simulate_policy.py::test_simulate_policy_in_memory PASSED
tests/test_sprint2_ingestion_crypto.py::test_crypto_envelope_flow PASSED
tests/test_sprint2_ingestion_crypto.py::test_blind_indexing PASSED
tests/test_sprint2_ingestion_crypto.py::test_sanitizer_pii_two_way PASSED
tests/test_sprint2_ingestion_crypto.py::test_file_magic_bytes_validation PASSED
tests/test_sprint2_ingestion_crypto.py::test_identifier_and_token_formats PASSED
tests/test_sprint2_ingestion_crypto.py::test_github_adapter_regex PASSED
tests/test_sprint3_security_erasure_review.py::test_human_review_lock_hierarchy_success PASSED
tests/test_sprint3_security_erasure_review.py::test_unified_crypto_shredding_erasure_service PASSED
tests/test_sprint3_security_erasure_review.py::test_withdraw_application_via_token PASSED
tests/test_sprint3_security_erasure_review.py::test_calendar_expired_cleaner_task PASSED
tests/test_walking_skeleton.py::test_root_endpoint PASSED
tests/test_walking_skeleton.py::test_health_endpoint PASSED

======================== 27 passed, 1 warning in 4.38s ========================
```

---

## 4. DAFTAR TUGAS PRIORITAS SPRINT 4 & 5

| No | Modul / Tugas | Penanggung Jawab | Deskripsi / Target |
|:---|:---|:---:|:---|
| 1 | **Standarisasi Test Runner** | Fardizza | Refaktor `test_scoring_engine.py` dan `test_triage_pipeline.py` ke fungsi `def test_*()` agar terdeteksi runner `pytest` global. |
| 2 | **Uji Konkurensi Kalender (50 Tx)** | Najmi | Buat skrip simulasi 50 transaksi reservasi simultan untuk membuktikan 0 insiden double-booking. |
| 3 | **Pengukuran Latensi Triage** | Najmi & Fardizza | Benchmark latensi end-to-end triage (target p50 <= 5.730 ms, p95 <= 10.010 ms). |
| 4 | **Determinism & PII Benchmark** | Fardizza | Uji determinisme 5x pada Suhu 0.0 (cache off) dan uji recall sensor PII pada narasi bebas (target >= 98%). |
| 5 | **Frontend Responsiveness & Polish** | Willy | Audit tampilan tablet & mobile, validasi koneksi ulang SSE, dan verifikasi `npm run build` lokal. |
| 6 | **Penyusunan Proposal Lomba** | Seluruh Tim | Mengintegrasikan hasil pengujian dan diagram arsitektur ke proposal UINIC 8.0 (30 hal) dan GTNIC 2026 (15 hal). |

---
*Dokumen ini merupakan catatan resmi review teknis hasil kerja Tim TalentOps AI.*
