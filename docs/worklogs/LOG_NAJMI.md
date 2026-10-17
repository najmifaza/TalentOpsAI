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
