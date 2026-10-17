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
