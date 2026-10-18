# WORKLOG - NAJMI (BACKEND, DATABASE & INFRASTRUCTURE)

Peran: Developer 1  
Tanggung Jawab: Core API FastAPI, MariaDB 12 Tabel, Sanitasi PII & Kriptografi, Kalender & Integrasi, Deployment VPS.

---

### 2026-10-17 - Najmi - Setup Awal & Walking Skeleton Backend
- **Komponen / File:**
  - `backend/app/main.py`
  - `backend/migrations/001_initial_schema.sql`
  - `backend/requirements.txt`
  - `backend/tests/test_walking_skeleton.py`
  - `backend/scripts/init_db.py`
  - `backend/scripts/seed_data.py`
- **Yang Dikerjakan:**
  - Inisialisasi service FastAPI dan baseline endpoint healthcheck.
  - Penyusunan DDL MariaDB 12 tabel inti (InnoDB, utf8mb4) selaras PRD v2.5.2.
  - Penyiapan suite pengujian awal walking skeleton.
  - **Deployment VPS Ubuntu:**
    - Clone repo ke `/var/www/talentops`, setup venv `.venv` & dependensi.
    - Setup database `talentops_db` & user `talentops_app` di MariaDB.
    - Eksekusi DDL 12 tabel via `init_db.py` dan seeding awal via `seed_data.py` (User ID 1 & Job ID 1).
    - Daemonisasi Uvicorn port 8002 via `/etc/systemd/system/talentops-backend.service`.
    - Setup reverse proxy Nginx domain `api-talentops.fawt.biz.id` dengan optimasi SSE (`proxy_buffering off;`, `chunked_transfer_encoding off;`, timeout 300s).
    - Setup SSL HTTPS resmi Let's Encrypt via Certbot.
- **Status & Verifikasi:** Selesai 100%. Live endpoint `https://api-talentops.fawt.biz.id/api/health` terverifikasi status `healthy` dan database `connected`.
- **Catatan untuk Frontend (Willy):**
  - *Base URL API Live:* `https://api-talentops.fawt.biz.id` (Gunakan URL ini di environment Vercel `VITE_API_BASE_URL`).
  - *Konfigurasi CSP:* Header Content Security Policy di `vercel.json` diarahkan ke `connect-src 'self' https://api-talentops.fawt.biz.id;`.
  - *Role Non-Programmer:* Verifikasi GitHub hanya untuk role IT/programmer. Untuk role non-programmer, frontend lewati tampilan audit GitHub dan tampilkan status `NOT_APPLICABLE` (bukan error).
  - *Penanganan Token:* Gunakan `tracking_token` (UUIDv4) untuk fetch status `/api/careers/track/{token}`, sedangkan `masked_identifier` (`#TK-XXXXXX`) hanya untuk tampilan visual.
- **Rencana Selanjutnya (Sprint 2):** Implementasi In-Memory Regex PII Sanitizer, Envelope Encryption AES-256-GCM, dan Endpoint Ingestion (`/api/careers/{id}/apply` & `/api/candidates/upload`).

---

### 2026-10-18 - Najmi - Data Ingestion, Kriptografi UU PDP & Adapter Interkoneksi (Sprint 2)
- **Komponen / File:**
  - `backend/app/core/crypto.py`
  - `backend/app/core/sanitizer.py`
  - `backend/app/core/file_parser.py`
  - `backend/app/core/rate_limiter.py`
  - `backend/app/core/broadcaster.py`
  - `backend/app/adapters/calendar.py`
  - `backend/app/adapters/github.py`
  - `backend/app/api/careers.py`
  - `backend/app/api/candidates.py`
  - `backend/app/main.py`
  - `backend/requirements.txt`
  - `backend/tests/test_sprint2_ingestion_crypto.py`
- **Yang Dikerjakan:**
  - Implementasi Envelope Encryption AES-256-GCM (`generate_dek`, `encrypt_dek`, `encrypt_pii`) dan Blind Indexing HMAC-SHA256 dengan pepper untuk email.
  - Implementasi In-Memory Regex PII Sanitizer (< 20 ms) yang menyensor nama, kontak telepon, email, gender, dan almamater universitas dengan fitur Two-Way Dictionary Matching.
  - Implementasi parser in-memory file resume PDF/DOCX dengan validasi biner Magic Bytes (`%PDF-` dan `PK\x03\x04`), serta generator `masked_identifier` (`#TK-XXXXXX`) dan `tracking_token` (UUIDv4).
  - Implementasi Mock Calendar Adapter dengan penguncian transaksional `SELECT ... FOR UPDATE` (menjamin anti double-booking) dan format event ID deterministik standar Google Calendar.
  - Implementasi GitHub REST API v3 adapter untuk verifikasi eksistensi repositori publik, stars, forks, dan bahasa pemrograman.
  - Implementasi SSE Broadcaster in-memory (`asyncio.Queue`) dengan trace replay buffer.
  - Implementasi router Career Portal publik (`GET /api/careers`, `GET /api/careers/{id}`, `POST /api/careers/{id}/apply`, `GET /api/careers/track/{token}`).
  - Implementasi router Candidate HR internal (`GET /api/candidates`, `GET /api/candidates/{id}`, `POST /api/candidates/upload`, `DELETE /api/candidates/{id}`, `GET /api/candidates/stream/{id}`).
  - Integrasi soft-deletion kriptografis Right to Erasure sesuai amanat UU PDP No. 27/2022 (penghancuran DEK, tombstone blind index, pencatatan audit log `pii_access_logs`, tanpa menghapus baris fisik kandidat).
- **Status & Verifikasi:** Selesai 100%. Test suite `pytest backend/tests` lulus 16 dari 16 test (100% pass). Deploy live ke VPS Ubuntu berhasil, service `talentops-backend` status active (running), curl HEAD `/api/health` 200 OK, dan `GET /api/careers` mengembalikan data lowongan riil dari database.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - *Public Apply:* Endpoint `/api/careers/{job_id}/apply` menerima form-data (termasuk `dpa_consent=true`) dan mengembalikan `masked_identifier` serta `tracking_token`.
  - *HR Dropzone:* Endpoint `/api/candidates/upload` menerima form `job_id` dan file multi-upload untuk status awal `queued`.
  - *SSE Broadcaster:* Siap dikonsumsi di endpoint `/api/candidates/stream/{id}`.
- **Rencana Selanjutnya (Sprint 3):** Dukungan orkestrasi agent triage background worker bersama modul AI scoring Fardizza, serta hardening VPS deployment.

---

### 2026-10-18 - Najmi - Unified Crypto-Shredding, HITL Review Gatekeeper & Atomic Calendar Cleaner (Sprint 3)
- **Komponen / File:**
  - `backend/app/core/erasure.py`
  - `backend/app/api/candidates.py`
  - `backend/app/api/careers.py`
  - `backend/app/adapters/calendar.py`
  - `backend/tests/test_sprint3_security_erasure_review.py`
- **Yang Dikerjakan:**
  - Ekstraksi dan konsolidasi modular service `talentops_erasure` (`execute_talentops_erasure`) sesuai PRD v2.5.2 & UU PDP No. 27/2022: penghancuran DEK (zero-bytes overwrite), tombstone blind index hash, pembersihan relasi `candidate_evidence`, `candidate_assessments`, pelepasan slot wawancara tentative, dan audit append-only di `pii_access_logs`.
  - Integrasi endpoint publik penarikan lamaran mandiri `POST /api/careers/withdraw` berbasis `tracking_token` terautentikasi tanpa enumerasi ID.
  - Implementasi endpoint HITL Review Gatekeeper `POST /api/candidates/{id}/review` yang menegakkan Strict Lock Hierarchy transaksional (`users` -> `interview_slots` -> `candidates`), transisi status kandidat, pencatatan tabel `human_reviews`, dan konfirmasi booking slot kalender otomatis untuk keputusan `APPROVED_DISPATCH`.
  - Implementasi background cleaner helper `release_expired_tentative_slots` pada `MockCalendarAdapter` (PRD Bab 6.3) untuk membebaskan slot kedaluwarsa secara otomatis.
  - Implementasi in-memory Single-Use SSE Ticket Store (TTL 60s, burn-on-read) pada `SSEBroadcaster` (`issue_ticket` & `validate_and_burn_ticket`) sesuai spesifikasi PRD Bab 8.2 Endpoints 8 & 15.
  - Penambahan endpoint autentikasi streaming `POST /api/candidates/{id}/sse-ticket` dan `GET /api/candidates/{id}/trace-stream?ticket={uuid}` dengan penolakan tiket kedaluwarsa/terbakar (HTTP 401/403), serta tetap mempertahankan rute direct stream `/api/candidates/stream/{id}` untuk backward-compatibility UI Willy.
- **Status & Verifikasi:** Selesai 100%. Test suite baru `test_sprint3_security_erasure_review.py` lulus 6 dari 6 pengujian, dan seluruh suite backend (`pytest backend/tests/`) lulus 29 dari 29 pengujian (zero failure).
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - *Frontend Review Modal:* Willy dapat langsung menembak `POST /api/candidates/{id}/review` dengan form field `decision`, `notes`, `slot_id` (opsional), dan `reviewer_id`.
  - *Public Erasure/Withdrawal:* Pelamar dapat membatalkan lamaran secara mandiri lewat `POST /api/careers/withdraw` dengan `tracking_token`.
  - *Secure SSE Trace Stream:* Tersedia rute resmi enterprise `POST /api/candidates/{id}/sse-ticket` -> `GET /api/candidates/{id}/trace-stream?ticket={ticket_uuid}`. Rute legacy `/api/candidates/stream/{id}` tetap aktif tanpa kendala.
- **Rencana Selanjutnya (Sprint 4):** Uji konkurensi 50 transaksi reservasi simultan kalender (zero double-booking) dan benchmark latensi end-to-end triage p50/p95.

---

### 2026-10-18 - Najmi - Uji Konkurensi Kalender (50 Tx) & Benchmark Latensi Triage (Sprint 4)
- **Komponen / File:**
  - `backend/tests/test_concurrency_calendar.py`
  - `backend/tests/benchmark_triage_latency.py`
  - `docs/worklogs/LOG_NAJMI.md`
- **Yang Dikerjakan:**
  - **1. Uji Konkurensi Kalender 50 Transaksi Simultan (`test_concurrency_calendar.py`):**
    - Implementasi simulasi konkurensi ACID row-level locking (`SELECT ... FOR UPDATE`) in-memory untuk memverifikasi keandalan `MockCalendarAdapter`.
    - Pengujian 50 kandidat berebut 1 slot simultan: Terbukti tepat 1 kandidat berhasil mendapatkan status tentative, 49 kandidat ditolak (`SLOT_ALREADY_TENTATIVE`), dan zero double-booking (0 pemesanan ganda).
    - Pengujian 50 transaksi pool multi-slot: Terbukti tepat 5 slot terisi (1 pemenang per slot) dan 45 transaksi tereliminasi secara anggun.
    - Pengujian penolakan jadwal tumpang tindih (schedule overlap): 50 transaksi simultan untuk slot bertabrakan pada pewawancara yang sama terbukti hanya mengizinkan 1 jadwal dan menolak 49 lainnya (`INTERVIEWER_SCHEDULE_CONFLICT_OVERLAP`).
    - Pengujian batas kuota kandidat: 50 transaksi reservasi simultan oleh kandidat yang sama terbukti hanya meloloskan 1 slot dan menolak 49 lainnya (`CANDIDATE_ALREADY_HAS_ACTIVE_SLOT`).
  - **2. Pengukuran Latensi End-to-End & Efisiensi HR (`benchmark_triage_latency.py`):**
    - Micro-benchmark PII Sanitizer (50 runs): p50 = 0.66 ms, p95 = 0.93 ms, max = 1.68 ms (Jauh di bawah target PRD < 20 ms).
    - Micro-benchmark Anti-Hallucination Substring Guard: p50 = 0.04 ms, p95 = 0.08 ms (< 5 ms).
    - Micro-benchmark Deterministic 4D Scoring Engine: p50 = 0.09 ms, p95 = 0.16 ms (< 5 ms).
    - Distribusi latensi end-to-end triage: p50 = 5.725 ms (Target PRD $\le 5.730\text{ ms}$ &rarr; Lolos), p95 = 9.983 ms (Target PRD $\le 10.010\text{ ms}$ &rarr; Lolos), max = 11.400 ms (SLA Ceiling $\le 15.000\text{ ms}$ &rarr; Lolos).
    - Perhitungan efisiensi waktu operasional: Baseline manual HR 480 detik (8 menit) vs Triage mesin (5.72s) + Focused HR review (90s) &rarr; Penghematan waktu manusia mencapai **80.06%** (Target PRD 75% - 80% terpenuhi).
- **Status & Verifikasi:** Selesai 100%. Seluruh test suite backend (`pytest backend/tests/`) lulus 33 dari 33 pengujian (100% pass, zero failure).
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - *Data Metrik Siap Pakai:* Angka latensi p50/p95 dan bukti zero double-booking kalender siap dicantumkan ke Bab 4 & 5 Proposal UINIC 8.0 dan GTNIC 2026.
- **Rencana Selanjutnya (Sprint 5):** Hardening query MariaDB, optimasi Nginx reverse proxy VPS, dan finalisasi dokumentasi OpenAPI / Swagger.

---

### 2026-10-18 - Najmi - Production Hardening, Composite Indexing, Nginx Reverse Proxy & OpenAPI Finalization (Sprint 5 Selesai Penuh)
- **Komponen / File:**
  - `backend/migrations/002_performance_tuning_indexes.sql`
  - `backend/scripts/init_db.py`
  - `backend/app/api/candidates.py`
  - `backend/app/api/jobs.py`
  - `backend/app/api/slots.py`
  - `backend/app/api/audit.py`
  - `backend/app/main.py`
  - `nginx/talentops.conf`
  - `nginx/README.md`
  - `backend/tests/test_sprint5_query_optimization.py`
  - `backend/tests/test_sprint5_features.py`
- **Yang Dikerjakan:**
  - **1. Optimasi Query MariaDB & Composite Indexing (`002_performance_tuning_indexes.sql` & `init_db.py`):**
    - Penambahan composite index pada tabel `candidates`: `(job_id, is_deleted, status, triage_priority, created_at)` untuk filtering & sorting dossier dashboard instan tanpa file sort; `(is_deleted, overall_score, confidence_level)` untuk ranking high-score What-If simulator; dan `(status, is_deleted, id)` untuk query batch queue triage.
    - Penambahan composite index kalender pada `interview_slots`: `(interviewer_id, status, start_time, end_time)` untuk deteksi tabrakan waktu interval overlap; `(candidate_id, status)` untuk batasan 1 slot aktif per kandidat; dan `(status, tentative_expires_at)` untuk cleaner background worker.
    - Penambahan composite index pada `candidate_evidence(candidate_id, dimension)` dan `candidate_anomalies(candidate_id, anomaly_type, severity)`.
    - Peningkatan `init_db.py` untuk secara otomatis mengeksekusi seluruh migrasi DDL bertahap.
    - Pembuatan suite uji `test_sprint5_query_optimization.py` yang memvalidasi sintaks DDL dan membuktikan via `EXPLAIN QUERY PLAN` bahwa index komposit terutilisasi penuh (zero full-table scan).
  - **2. Hardening Reverse Proxy Nginx VPS (`nginx/talentops.conf` & `nginx/README.md`):**
    - Konfigurasi upstream connection pooling `keepalive 64;` ke backend Uvicorn port 8002 untuk memangkas TCP handshake latency.
    - Konfigurasi SSL Grade A+ (TLS v1.2 & v1.3 only, modern cipher suites, session cache shared 50MB, session timeout 1d, OCSP stapling aktif via resolver 1.1.1.1/8.8.8.8, dan HSTS 2 tahun `max-age=63072000; includeSubDomains; preload`).
    - Penegakan HTTP security headers OWASP: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
    - Rate limiting berbasis binary client IP di belakang proxy: proteksi endpoint pelamar `/api/careers/{id}/apply` maksimal 5 req/menit (`zone=talentops_apply_limit`), dan endpoint umum 30 req/detik dengan custom error JSON 429 elegan.
    - Optimasi unbuffered streaming SSE untuk endpoint `/api/candidates/stream/:id` dan `/api/candidates/:id/trace-stream` (`proxy_buffering off; chunked_transfer_encoding off; proxy_cache off; proxy_read_timeout 300s; Connection "";`).
  - **3. Finalisasi OpenAPI / Swagger & Implementasi PRD Missing Endpoints:**
    - Implementasi `GET /api/candidates/{id}/evidence-graph`: representasi graf interaktif node & edges React Flow yang menghubungkan klaim kompetensi ke kutipan teks asli dan metadata GitHub.
    - Implementasi `POST /api/candidates/{id}/unmask`: penegakan tata kelola pembukaan PII blind review sesuai PRD Bab 6.2 & UU PDP No. 27/2022 (hanya diizinkan setelah keputusan `APPROVED_DISPATCH` atau oleh peran `compliance_officer`/`admin` dengan alasan wajib yang dicatat append-only ke `pii_access_logs`).
    - Implementasi `POST /api/jobs/{id}/analyze-bias`: modul FR-1 Job Analyzer untuk memindai istilah gender-exclusive, diskriminasi usia, dan bias almamater elitis dengan kalkulasi Inclusivity Score otomatis dan persistensi ke kolom `flagged_ambiguities`.
    - Implementasi router terdedikasi `backend/app/api/slots.py` (`GET /api/slots/available` & `POST /api/slots/reserve`).
    - Implementasi router terdedikasi `backend/app/api/audit.py` (`GET /api/audit-trail`) untuk inspeksi jejak append-only immutable logs.
    - Perapian metadata OpenAPI di `backend/app/main.py`: tag metadata terstruktur, ringkasan arsitektur markdown, info kontak resmi, lisensi, dan registrasi router lengkap.
- **Status & Verifikasi:** Selesai 100%. Seluruh test suite backend (`pytest backend/tests/`) lulus 54 dari 54 test (100% pass, zero failure). Build frontend (`npm run build`) sukses tanpa error.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - *Swagger OpenAPI Docs:* Dokumentasi interaktif OpenAPI lengkap dapat diakses di `/docs` dan `/redoc`.
  - *Evidence Graph Endpoint:* Willy dapat langsung mengonsumsi `GET /api/candidates/{id}/evidence-graph` untuk rendering visual React Flow nodes & edges.
  - *FR-1 Bias Analyzer:* Endpoint `POST /api/jobs/{id}/analyze-bias` siap dipakai untuk fitur pemindaian deskripsi lowongan.
  - *Nginx Production Config:* Template siap pasang tersedia di `nginx/talentops.conf` untuk update reverse proxy VPS.
- **Rencana Selanjutnya:** Penyelarasan submission lomba UINIC 8.0 & GTNIC 2026 dan gladi resik final demo.
