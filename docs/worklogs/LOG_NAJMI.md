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
- **Yang Dikerjakan:**
  - Inisialisasi service FastAPI dan baseline endpoint healthcheck.
  - Penyusunan DDL MariaDB 12 tabel inti (InnoDB, utf8mb4) selaras PRD v2.5.2.
  - Penyiapan suite pengujian awal walking skeleton.
- **Status & Verifikasi:** Berhasil dijalankan di lokal, test skeleton lolos.
- **Catatan untuk Frontend (Willy):**
  - *Role Non-Programmer:* Verifikasi GitHub hanya untuk role IT/programmer. Untuk role non-programmer, frontend lewati tampilan audit GitHub dan tampilkan status `NOT_APPLICABLE` (bukan error).
  - *Penanganan Token:* Gunakan `tracking_token` (UUIDv4) untuk fetch status `/api/careers/track/{token}`, sedangkan `masked_identifier` (`#TK-XXXXXX`) hanya untuk tampilan visual.
  - *CSP Produksi:* Header CSP diatur di `vercel.json` edge frontend (`https://api.talentops.id`).
- **Rencana Selanjutnya:** Implementasi In-Memory Regex PII Sanitizer & Master KEK envelope encryption.
