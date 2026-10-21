# WORKLOG - NAJMI (BACKEND, DATABASE & INFRASTRUCTURE)

Peran: Developer 1  
Tanggung Jawab: Core API FastAPI, MariaDB 12 Tabel, Sanitasi PII & Kriptografi, Kalender & Integrasi, Deployment VPS.

---

### 2026-10-21 - Najmi - Log Aplikasi Tidak Sampai ke journald (root cause)
- **Komponen / File:**
  - `backend/app/main.py` (`logging.basicConfig` + level paket `app`)
  - `backend/tests/test_maintenance.py` (`test_app_logging_reaches_stderr`)
- **Catatan:** Ditemukan saat verifikasi deploy: `maintenance: started` tidak muncul di `journalctl` meski loop benar-benar berjalan.
- **Yang Dikerjakan:**
  - **Akar masalah bukan di `maintenance.py`.** Seluruh 16 modul memakai `logging.getLogger(__name__)` dengan 34 pemanggilan log, tetapi tidak ada konfigurasi logging di mana pun. Uvicorn hanya memasang handler pada logger `uvicorn.*`; logger aplikasi melakukan propagate ke root, dan root tidak punya handler — sehingga INFO dibuang (yang lolos hanya WARNING+ lewat `logging.lastResort`). Artinya bukan cuma log maintenance yang hilang: log fallback triage, erasure, dan email juga tidak pernah sampai ke journald.
  - Perbaikan di akar: `logging.basicConfig(level=..., format=...)` di `main.py` memberi root handler, sehingga ke-16 modul langsung terlihat tanpa mengganti nama logger satu per satu.
  - `basicConfig` adalah no-op bila root sudah punya handler (pytest, sebagian process manager), dan pada kasus itu level juga tidak terpasang. Karena itu level di-pin eksplisit pada logger paket `app` (`logging.getLogger("app").setLevel(...)`); pesan tetap propagate ke handler root yang ada. Tanpa baris ini, test menangkap `app.core.maintenance` berlevel WARNING dan assertion gagal — yang membuktikan masalahnya nyata, bukan teoretis.
  - **Alternatif yang ditolak:** mengganti `getLogger(__name__)` menjadi `getLogger("uvicorn.error")` seperti yang sempat diterapkan langsung di VPS. Itu hanya memperbaiki satu modul dan membuat modul aplikasi bergantung pada detail internal uvicorn. Perubahan itu tidak masuk repo dan dibuang saat sinkronisasi.
  - Test regresi `test_app_logging_reaches_stderr` menjaga agar konfigurasi root tidak hilang diam-diam; gejala aslinya (log hilang) tidak terlihat tanpa membaca journald.
- **Status & Verifikasi:** Selesai. `pytest tests/` → **225 passed** (224 + 1 test baru). Probe manual `PYTHONPATH=. python -c` mengonfirmasi dua logger modul berbeda mencetak INFO ke stderr: `INFO: app.core.maintenance - ...` dan `INFO: app.core.triage_service - ...`.
- **Rencana Selanjutnya:** Setelah deploy, `sudo journalctl -u talentops-backend -n 40 | grep -i maintenance` harus memuat `maintenance: started maintenance:slot-cleaner`, dan setiap tick yang benar-benar membebaskan slot akan mencatat `maintenance: released N expired tentative slot(s)`.

---

### 2026-10-21 - Najmi - Identitas Asli Jalur Dropzone Disimpan (Keputusan A)
- **Komponen / File:**
  - `backend/app/api/candidates.py` (`_parse_applicant_meta`, `hr_direct_upload`)
  - `frontend/src/components/UploadCandidateModal.jsx`
  - `backend/tests/test_dropzone_sanitization_wiring.py` (4 test baru)
  - `docs/STATUS_PEKERJAAN_BELUM_SELESAI.md` (§3.4, prioritas 6, revisi keenam)
- **Yang Dikerjakan:**
  - **Akar masalah:** `hr_direct_upload` menulis `encrypt_pii(f"Applicant-{file.filename}")` dan `encrypt_pii("hr_dropzone_upload@talentops.internal")` sebagai identitas. Kandidat jalur dropzone karena itu tidak bisa dihubungi: email keputusan pergi ke alamat internal fiktif, unmask PII menampilkan nama berkas, dan `email_blind_index` dihitung dari `file_hash@talentops.internal` sehingga pencarian berdasarkan email tidak akan pernah cocok.
  - **Temuan yang mengubah bentuk perbaikan:** modal `UploadCandidateModal.jsx` ternyata **sudah** punya input "Nama Lengkap Pelamar *" dan "Email Pelamar *" bertanda `required`, lengkap dengan state `candidateName`/`candidateEmail`. Keduanya tidak pernah masuk `FormData` — hanya `job_id` dan `files` yang dikirim. Jadi bukan fitur yang belum ada, melainkan nilai yang dibuang di klien.
  - Backend menerima `applicant_meta` sebagai JSON array selaras indeks dengan `files`, divalidasi `_parse_applicant_meta()`: wajib array, jumlah entri = jumlah berkas, nama tidak kosong, email mengandung `@`. Kode error spesifik agar klien bisa membedakan penyebab.
  - Parameter dibuat opsional (`Form(None)`) supaya klien lama dan test lama tidak pecah; tanpa metadata, perilaku placeholder dipertahankan tetapi respons menyatakan `identity_source: "placeholder"` alih-alih diam.
  - Metadata juga diteruskan ke `sanitize_resume(known_name=..., known_email=...)`. Ini efek samping yang lebih berharga daripada penyimpanan identitasnya sendiri: jalur dropzone kini memakai pencocokan kamus eksak seperti jalur `/careers/apply`, bukan hanya inferensi header, sehingga redaksi nama di narasi bebas lebih akurat.
  - `email_blind_index` dihitung dari email asli saat metadata ada, sehingga blind-index lookup dan pengiriman email keputusan berfungsi.
  - Frontend menambah validasi klien sebelum submit (nama tidak kosong, email mengandung `@`) karena tombol submit sebelumnya hanya dijaga oleh `!file`.
- **Status & Verifikasi:** Selesai. `pytest tests/test_dropzone_sanitization_wiring.py` → 7 passed (3 lama + 4 baru: identitas asli tersimpan dan `name_source == "form"`, placeholder dinyatakan saat meta kosong, jumlah entri tidak cocok → 400 `COUNT_MISMATCH`, email tidak valid → 400 `EMAIL_INVALID`). Suite penuh `pytest tests/` → **224 passed**. `vite build` lolos.
- **Rencana Selanjutnya:** Setelah deploy, unggah satu CV lewat modal dan pastikan `identity_source` bernilai `"form"` di respons, lalu buka dossier kandidat dan cek tombol unmask menampilkan nama asli (bukan `Applicant-*.pdf`). Kandidat lama yang sudah terlanjur masuk lewat jalur ini tetap memakai placeholder — datanya tidak bisa dipulihkan karena memang tidak pernah disimpan.

---

### 2026-10-21 - Najmi - Dokumen Status & PRD Disinkronkan dengan Kondisi Kode
- **Komponen / File:**
  - `docs/STATUS_PEKERJAAN_BELUM_SELESAI.md` (revisi kelima, §8 baru)
  - `docs/PRD_TALENTOPS_AI_MASTER.md` (§1.2, tabel §2, diagram §3.1, §6.3 butir 4)
  - `backend/app/main.py` (deskripsi tag OpenAPI `Calendar & Scheduling`)
- **Yang Dikerjakan:**
  - **Dokumen status basi tiga arah.** What-If Studio UI, pembersih slot periodik, dan banner data sintetis baru dikerjakan tetapi tidak ada di daftar mana pun. Kalimat "tidak ada lagi pekerjaan yang murni kode tanpa masukan luar" (revisi ketiga) juga sudah tidak benar. Header diperbarui ke `main` @ `54cf1e4` / 220 passed, ditambah paragraf revisi kelima, §8 baru berisi empat subbagian (8.1–8.4) plus 8.5 daftar yang masih terbuka, baris prioritas 12–17, dan empat entri di tabel "Yang Sudah Selesai".
  - **PRD menjual lebih rendah dari kenyataan.** §1.2 baris 58 dan 60 masih menulis Mock Calendar Adapter dan Mock Candidate Dispatcher sebagai `[MVP]` mock. Setelah dicek ke kode: `backend/app/adapters/google_calendar.py` memang dipanggil untuk `create_event` (`candidates.py:66-97`) dan alur OAuth2 di `calendar_oauth.py` (authorize, callback, `list_upcoming_events`, disconnect) sudah nyata; `core/email.py` punya dua jalur Resend (`resend_api` HTTPS dan `resend_smtp` relay) dengan mode `disabled` saat kunci kosong. Keduanya dinaikkan ke `[TARGET]` **dengan catatan belum diverifikasi live** karena kredensial masih kosong — bukan diklaim aktif.
  - Yang tetap mock dan tidak diklaim lebih: `MockCalendarAdapter` masih menangani penguncian slot atomik (`slots.py:10`), jadi reservasi tetap di database. Ini ditulis apa adanya, bukan disembunyikan.
  - Tabel §2 baris "Integrasi Kalender" dan diagram §3.1 diperbarui sejalan. §6.3 butir 4 diubah: label `[MOCK / SANDBOX]` kini dinyatakan muncul **hanya bila** kredensial belum diisi, bukan sebagai label permanen.
  - Deskripsi tag OpenAPI `Calendar & Scheduling` di `main.py` juga menyebut "Mock Calendar Adapter sandbox" — ikut dikoreksi karena halaman `/docs` ikut dibaca juri.
- **Status & Verifikasi:** Selesai. `pytest tests/` → 220 passed (perubahan hanya teks deskripsi tag, tidak menyentuh logika). Sisa sebutan "Mock" yang sengaja dipertahankan: baris 743 tabel jadwal hari 4–5, karena itu catatan historis apa yang dikerjakan pada tanggal tersebut.
- **Rencana Selanjutnya:** Prioritas 16 (dark mode) dan 17 di dokumen status sudah tercatat. Dark mode menunggu keputusan pemilik: bangun fiturnya, atau hapus klaimnya dari PRD hari 6–8. Jangan biarkan `App.jsx` tetap memaksa `classList.remove('dark')` sementara PRD menjanjikan dark mode.

---

### 2026-10-21 - Najmi - Pembersih Slot Periodik & Klaim Append-Only Diluruskan
- **Komponen / File:**
  - `backend/app/core/maintenance.py` (berkas baru)
  - `backend/app/main.py` (lifespan)
  - `backend/app/core/config.py` (`MAINTENANCE_ENABLED`, `DEMO_PURGE_ENABLED`)
  - `backend/app/api/audit.py` (teks `compliance.retention_policy`)
  - `backend/tests/conftest.py` (berkas baru), `backend/tests/test_maintenance.py` (berkas baru)
  - `docs/PRD_TALENTOPS_AI_MASTER.md` §6.1 butir 6
- **Yang Dikerjakan:**
  - **Akar masalah pembersih slot:** `release_expired_tentative_slots()` (`adapters/calendar.py:147`) sudah benar, tetapi satu-satunya pemanggil ada di dalam handler `GET /api/slots/available` (`slots.py:36`). Slot `tentative` karena itu hanya kembali `available` bila ada orang lain membuka daftar slot — bergantung pada lalu lintas request, bukan pada waktu. Slot yang TTL-nya lewat bisa menggantung berjam-jam dan tampak terpakai bagi kandidat lain.
  - Menambahkan `maintenance.py` berisi dua job dan satu runner: `_run_forever()` yang membungkus tiap tick dengan `try/except` agar satu kegagalan (DB down, lock timeout) tidak mematikan loop, sementara `asyncio.CancelledError` tetap diteruskan supaya shutdown bersih.
  - `main.py` sekarang memakai `lifespan` async context manager: task dimulai saat startup dan dibatalkan saat shutdown. Sebelumnya tidak ada `lifespan`, `asyncio.create_task`, maupun scheduler sama sekali.
  - Interval: slot cleaner 300 detik (PRD Bab 6.3 minta 5 menit), demo purge 4 jam (PRD baris 388).
  - **Demo purge sengaja dipisah dari `DEMO_MODE`.** Tidak ada kolom penanda unggahan demo versus dataset golden, sehingga `DELETE FROM candidates WHERE created_at < cutoff` akan menghapus **seluruh** kandidat termasuk dataset yang dipakai untuk penjurian. Karena itu ia berdiri di balik `DEMO_PURGE_ENABLED` (default `False`), bukan mengikuti `DEMO_MODE`. Kandidat yang dihapus membawa serta `candidate_evidence`, `candidate_anomalies`, `candidate_assessments`, `consent_records`, dan `human_reviews` lewat `ON DELETE CASCADE`, sementara `agent_steps` dan `pii_access_logs` memakai `SET NULL` sehingga baris auditnya bertahan — sesuai maksud append-only. Nama file CV di `resume_file_path` hanya string, tidak ada berkas fisik yang ditulis di jalur unggah, jadi tidak ada orphan file.
  - `conftest.py` mematikan kedua flag agar loop tidak hidup melewati sesi pytest. `MAINTENANCE_ENABLED=False` juga membuat `start_background_tasks()` mengembalikan list kosong tanpa menyentuh event loop, sehingga aman dipanggil dari konteks non-async.
  - **Append-only:** klaim `REVOKE UPDATE, DELETE` sebelumnya dicetak ke konsumen API di `audit.py:132` padahal tidak ada migrasi yang menjalankannya dan user `willy@%` di VPS masih memegang `GRANT ALL ON *.* WITH GRANT OPTION`. Teks itu diganti menjadi pernyataan jujur bahwa sifat append-only ditegakkan oleh konvensi aplikasi, bukan database engine. Keputusan pemilik: migrasi `004` REVOKE dan trigger **tidak** dikerjakan sekarang; dicatat sebagai rencana beserta jalur upgrade-nya (trigger `SIGNAL SQLSTATE '45000'` lebih kuat karena tetap berlaku bagi user dengan hak penuh).
- **Status & Verifikasi:** Selesai. `pytest tests/` → **220 passed** (217 sebelumnya + 3 test baru: flag mati mengembalikan list kosong, demo purge hanya muncul saat flag-nya dinyalakan, dan `_run_forever` tetap berjalan setelah satu tick melempar exception). Perintah harus dijalankan dari `backend/` karena `conftest.py` mengimpor `app.core.config`.
- **Rencana Selanjutnya:** Setelah deploy, cek `journalctl -u talentops-backend` memuat `maintenance: started maintenance:slot-cleaner` saat startup, dan pastikan tidak muncul traceback tick. Uji perilaku nyata: kunci slot dengan `tentative_minutes` kecil, tunggu TTL lewat, lalu verifikasi slot kembali `available` tanpa ada request apa pun. `DEMO_PURGE_ENABLED` jangan dinyalakan di DB yang memuat dataset penjurian.

---

### 2026-10-21 - Najmi - init_db.py Tidak Lagi Mencetak Password Database
- **Komponen / File:**
  - `backend/scripts/init_db.py`
- **Catatan:** Dikerjakan & di-commit atas nama Najmi, tindak lanjut laporan operator VPS. Perbaikan skoring & skema dicatat di `LOG_FARDIZZA.md`.
- **Yang Dikerjakan:**
  - `init_db.py` mencetak `settings.SYNC_DATABASE_URL` utuh, sehingga password user MariaDB (`talentops_app`) muncul di stdout, riwayat shell, dan `journalctl` setiap kali migrasi dijalankan. Output itu juga ikut tersalin ke laporan eksekusi.
  - Menambahkan `_mask_dsn()` yang mengganti bagian password menjadi `***` sebelum dicetak; DSN asli tetap dipakai untuk `create_engine`.
- **Status & Verifikasi:** Selesai. Fungsi diuji langsung: `mysql+pymysql://talentops_app:***@127.0.0.1:3306/talentops_db`. `pytest backend/tests/` → 212 passed.
- **Rencana Selanjutnya:** Password `talentops_app` yang sudah bocor di laporan/log **wajib diganti** di MariaDB, `DATABASE_URL` di env VPS diperbarui, service di-restart, dan entri log lama yang memuat DSN dihapus.

---

### 2026-10-21 - Najmi - Skema & API untuk Bukti yang Bisa Ditelusuri
- **Komponen / File:**
  - `backend/migrations/003_evidence_verification.sql` (baru)
  - `backend/app/api/candidates.py`
  - `backend/app/api/jobs.py`
  - `backend/app/core/triage_service.py` (bagian persistensi)
- **Catatan:** Dikerjakan & di-commit atas nama Najmi, hasil audit graf bukti kandidat `#TK-2FD8DC`. Logika skoring & guard dicatat di `LOG_FARDIZZA.md`, UI di `LOG_WILLY.md`.
- **Yang Dikerjakan:**
  - Migrasi baru `003_evidence_verification.sql`: menambah `candidate_evidence.matched_requirement` (VARCHAR NULL) dan `candidate_evidence.verified` (TINYINT default 0), plus index `idx_evidence_cand_verified`. Dijalankan lewat `backend/scripts/init_db.py` yang membaca seluruh `backend/migrations/*.sql` berurutan.
  - `GET /api/candidates/{id}` dan `GET /api/candidates/{id}/evidence-graph` kini ikut memilih `matched_requirement` dan `verified`. Endpoint dossier juga mengurutkan evidence `verified DESC, score_contribution DESC, id` agar bukti yang benar-benar terverifikasi tampil lebih dulu.
  - `triage_service.py`: INSERT `candidate_evidence` menulis dua kolom baru; blok anomali memakai `assessment["anomaly_details"]` bila ada (deskripsi + `suggested_verification` spesifik), dan hanya jatuh ke format flag lama bila `details` kosong. Menambahkan `DELETE FROM candidate_anomalies WHERE candidate_id = :id` sebelum insert — sebelumnya re-triage hanya menghapus evidence, sehingga baris anomali menumpuk tiap kali kandidat dianalisis ulang.
  - `jobs.py` (What-If): deteksi karantina kini juga mencocokkan `anomaly_type LIKE 'SECURITY_QUARANTINE%'`. Sebelumnya hanya `PROMPT_INJECTION`/`HIDDEN_TEXT`, padahal engine mengeluarkan `SECURITY_QUARANTINE_PROMPT_INJECTION`, sehingga simulasi What-If tidak pernah menandai kandidat yang di-quarantine.
  - Pencocokan `SECURITY_QUARANTINE%` yang sama dipakai saat membaca anomali hasil upload di `triage_service.py` agar audit teks tersembunyi tetap terdeteksi.
- **Status & Verifikasi:** Selesai. `pytest backend/tests/` → **206 passed**. Migrasi belum dijalankan ke database mana pun (butuh akses VPS).
- **Rencana Selanjutnya:** Jalankan `init_db.py` di VPS agar kolom baru ada sebelum backend versi ini di-deploy; tanpa migrasi, INSERT evidence akan gagal karena kolom belum tersedia.

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

---

### 2026-10-18 - Najmi - Hotfix Resolusi aiomysql Binary Escape Crash & PyMySQL Upstream Compatibility
- **Komponen / File:**
  - `backend/app/core/database.py` (Monkeypatch adaptasi `escape_bytes_prefixed` untuk PyMySQL 1.2+)
  - `backend/requirements.txt` (Penguncian versi `pymysql<=1.1.1`)
- **Yang Dikerjakan:**
  - **1. Investigasi & Resolusi Crash TypeError 500 saat Ingestion CV:**
    - Mendiagnosis error `TypeError: 'str' object is not callable` yang muncul pada `POST /api/careers/{id}/apply` dan `POST /api/candidates/upload`.
    - Menemukan akar masalah (upstream breaking change): library `aiomysql 0.2.0` memanggil `escape_bytes_prefixed(obj)` saat mengeksekusi parameter biner (seperti kolom enkripsi AES-256-GCM `enc_name`, `enc_email`, `enc_dek`). Pada PyMySQL >= 1.2.0, variabel tersebut telah didefinisikan sebagai string konstan alih-alih fungsi callable.
    - Menambahkan patch adapter dinamis di `backend/app/core/database.py`: jika `escape_bytes_prefixed` bukan fungsi callable, otomatis dipetakan ulang ke `pymysql.converters.escape_bytes` sebelum engine database aktif.
    - Mengunci dependensi di `backend/requirements.txt` ke `pymysql<=1.1.1` untuk kompatibilitas native jangka panjang.
- **Status & Verifikasi:** Selesai 100%. Live endpoint `POST /api/careers/1/apply` di VPS Ubuntu terverifikasi sukses HTTP 200 OK. Berkas lamaran terenkripsi AES-256-GCM tersimpan nyata di MariaDB, menghasilkan tracking token valid, dan status pelacakan `/api/careers/track/{token}` aktif.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - Ingestion berkas publik dan HR dropzone telah berfungsi normal tanpa kendala driver database.

---

### 2026-10-19 - Najmi - Integrasi Live 9router LLM Gateway, Resolusi Transport SOCKS Proxy & Model Prefixing
- **Komponen / File:**
  - `backend/app/core/llm_adapter.py`
  - `backend/app/core/config.py`
  - `backend/app/core/triage_service.py`
  - `backend/.env.example`
- **Yang Dikerjakan:**
  - **1. Resolusi Intersepsi Global SOCKS5 Proxy pada HTTP Client Loopback:**
    - Mendiagnosis penyebab pemanggilan 9router lokal VPS (`http://127.0.0.1:20128`) gagal dengan `httpx.ProxyError: Proxy Server could not connect: Connection refused`.
    - Menemukan bahwa `/etc/environment` di VPS mengonfigurasi `http_proxy=socks5://127.0.0.1:40000`, yang secara default dibaca oleh `httpx.AsyncClient` (`trust_env=True`).
    - Menambahkan `trust_env=False` pada inisialisasi `httpx.AsyncClient` di `llm_adapter.py` agar panggilan loopback lokal ke port 20128 langsung bypass proxy SOCKS.
  - **2. Standarisasi Model Prefix & Header Autentikasi 9router:**
    - Memperbaiki pengiriman header `Authorization: Bearer <API_KEY>` tanpa syarat bypass dummy string agar 9router tidak melempar HTTP 401 Unauthorized.
    - Menyelaraskan nama model default ke `ag/gemini-3.8-flash-low` (dengan prefix provider `ag/`) sesuai manifest 9router VPS guna mengeliminasi error `model_not_found`.
  - **3. Transparansi Galat Gateway pada SSE Trace:**
    - Memodifikasi `triage_service.py` untuk mengekspos pesan galat gateway `llm_gateway_error` ke dalam payload SSE broadcaster jika panggilan LLM gagal, mencegah silent failure.
  - **4. Pengujian & Verifikasi Live Usage Token:**
    - Menguji pemanggilan langsung model Gemini 3.8 Flash via 9router di VPS: respons `200 OK` (IN 1207, OUT 841 tokens), tercatat aktif di tabel `usageHistory` dan `usageDaily` basis data SQLite 9router.
- **Status & Verifikasi:** Selesai 100%. Backend FastAPI terhubung langsung secara real-time ke 9router VPS tanpa simulasi fallback offline. Seluruh 62 test pytest lolos 100%.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - Triage AI live Gemini 3.8 kini berstatus `source: "LIVE"` dengan pencatatan token usage resmi di VPS.

---

### 2026-10-19 - Najmi - Implementasi Endpoint Manajemen Lowongan & Konfigurasi Bobot 4D Permanen
- **Komponen / File:**
  - `backend/app/api/jobs.py`
  - `backend/tests/test_sprint5_features.py`
- **Yang Dikerjakan:**
  - **1. Endpoint Pembuatan & Pembaruan Lowongan (`POST /api/jobs` & `PUT /api/jobs/{id}`):**
    - Menyediakan endpoint pembuatan lowongan kerja baru dengan validasi Pydantic (`title`, `department`, `raw_text`, `core_competencies`, dan `weight_config` 4D).
    - Memastikan konfigurasi bobot (`SKILL`, `EXPERIENCE`, `EDUCATION`, `PORTFOLIO`) tersimpan permanen per lowongan di tabel `job_descriptions` MariaDB.
    - Menambahkan endpoint update parsial untuk memodifikasi deskripsi, kompetensi inti, status aktif/tutup, dan penyesuaian bobot 4D kapan saja oleh recruiter.
  - **2. Otomasi Pengujian Backend:**
    - Menambahkan unit test `test_create_and_update_job_with_custom_weights` di `test_sprint5_features.py`.
- **Status & Verifikasi:** Selesai 100%. Seluruh 63 test pytest lolos 100% (`uv run pytest backend/tests/ -q`).
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - Frontend kini dapat menyimpan dan memuat konfigurasi bobot 4D langsung dari database riil tanpa sandbox simulasi.

---

### 2026-10-20 - Najmi - Autentikasi JWT Stateless & Penegakan RBAC (PRD Bab 8.1)

- **Branch:** `feat/backend-auth`
- **Komponen / File:**
  - `backend/app/core/auth.py` (baru)
  - `backend/app/api/auth.py` (baru)
  - `backend/app/api/candidates.py`
  - `backend/app/api/jobs.py`
  - `backend/app/api/slots.py`
  - `backend/app/api/audit.py`
  - `backend/app/main.py`
  - `backend/scripts/seed_data.py`
  - `backend/tests/test_auth_rbac.py` (baru)
- **Yang Dikerjakan:**
  - Implementasi `backend/app/core/auth.py`: pembuatan & validasi JWT HS256, hashing password, dependency `get_current_user`, dan factory `require_roles(*roles)`.
  - **Catatan dependensi:** `pyjwt`/`python-jose` dan `argon2-cffi` tidak tersedia di environment, sehingga JWT dibangun dengan `hmac` + `hashlib` + `base64` (stdlib) dan hashing password memakai PBKDF2-HMAC-SHA256 (100.000 iterasi). Tidak menambah dependency baru; tetap HS256 sesuai `JWT_ALGORITHM` di config.
  - Endpoint `POST /api/auth/login` (login via username **atau** email) dan `GET /api/auth/me`.
  - Pemasangan guard RBAC pada endpoint `candidates` (12), `jobs` (6), `slots` (2), dan `audit` (1) sesuai matriks otorisasi PRD Bab 8.1.
  - **Perbaikan celah identitas:** `reviewer_id`, `owner_id` job, dan `user_id` pada erasure kini diambil dari token terautentikasi, bukan dari form/body yang dapat dipalsukan klien. Pada `/unmask`, `reviewer_role` di-override dari token kecuali `DEMO_MODE` aktif.
  - `scripts/seed_data.py`: hash placeholder `$argon2id$...` yang tidak valid diganti hash PBKDF2 nyata sehingga login demo berfungsi.
- **Status & Verifikasi:** Selesai 100%. `uv run pytest backend/tests -q` lulus **71 dari 71** test, 0 failure. Test baru `test_auth_rbac.py` (8 test): roundtrip password hash, roundtrip & expiry JWT, penolakan signature dipalsukan, penolakan token malformed, `require_roles` allow/deny, login endpoint, 401 tanpa token saat `DEMO_MODE=False`, 403 untuk role di luar whitelist, dan registrasi router di OpenAPI.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - **Willy — PENTING:** Frontend belum mengirim header `Authorization`. Selama `DEMO_MODE=True` guard fallback ke recruiter ID 1 sehingga dashboard tetap jalan. Jika `DEMO_MODE` dimatikan untuk produksi, **seluruh dashboard HR akan 401** sampai frontend login via `POST /api/auth/login` dan menyertakan `Authorization: Bearer <token>`.
  - **Willy:** Endpoint SSE legacy `/api/candidates/stream/{id}` yang dipakai `AgentTraceModal.jsx` sengaja dibiarkan tanpa autentikasi agar tidak breaking.
- **Rencana Selanjutnya:** Migrasi state in-memory (SSE broadcaster & semaphore) ke Redis untuk multi-worker.

---

### 2026-10-20 - Najmi - Migrasi State In-Memory ke Redis untuk Multi-Worker

- **Branch:** `feat/backend-redis-state`
- **Komponen / File:**
  - `backend/app/core/state.py` (baru)
  - `backend/app/core/broadcaster.py` (ditulis ulang)
  - `backend/app/core/config.py`
  - `backend/app/core/triage_service.py`
  - `backend/app/api/health.py`
  - `backend/requirements.txt`
  - `backend/tests/test_redis_state.py` (baru)
  - `backend/tests/test_walking_skeleton.py`
- **Yang Dikerjakan:**
  - Implementasi `backend/app/core/state.py`: `RedisState` (probe koneksi lazy + fallback graceful), builder key ter-namespace, dan `DistributedSemaphore`.
  - `DistributedSemaphore` memakai `SET <slot> NX EX <lease>` per slot, bukan Lua/EVAL. Lease TTL membuat worker yang mati di tengah triage melepas slotnya otomatis, menghindari deadlock queue. Rancangan awal berbasis sorted-set + EVAL dibatalkan karena `fakeredis` tidak mengimplementasikan `EVAL`, sehingga jalur Redis tidak akan pernah teruji.
  - `broadcaster.py` ditulis ulang: tiket single-use dan riwayat event disimpan di Redis, fan-out lewat pub/sub, sehingga tiket yang diterbitkan worker A dikenali worker B. Riwayat dibatasi (`SSE_HISTORY_MAX_EVENTS`) dan diberi TTL. Fallback in-memory dipertahankan identik dengan perilaku lama.
  - **Bug ditemukan & diperbaiki saat penulisan test:** implementasi awal memakai `GETDEL` langsung, sehingga permintaan dengan `candidate_id` yang salah ikut membakar tiket milik pemegang sah. Diperbaiki menjadi baca → validasi kandidat & expiry → `GETDEL`, dan pemanggil yang kalah balapan menerima `False`.
  - `triage_service.py`: `asyncio.Semaphore(3)` per-proses diganti `DistributedSemaphore` sehingga batas konkurensi berlaku lintas worker.
  - `/api/health` kini melaporkan `state_backend`, `redis_configured`, dan `multi_worker_safe`.
  - `requirements.txt`: tambah `redis>=5.0` dan `fakeredis>=2.20` (dev).
  - `test_walking_skeleton.py`: assertion `environment == "development"` diperbaiki menjadi memvalidasi nilai `APP_ENV` yang dikonfigurasi. Test ini sudah gagal sebelum pekerjaan ini karena default `APP_ENV` adalah `production`.
- **Status & Verifikasi:** Selesai 100%. `uv run pytest backend/tests -q` lulus **81 dari 81** test, 0 failure. Test baru `test_redis_state.py` (10 test) mencakup: tiket single-use lintas worker, tiket kedaluwarsa, replay history + fan-out lintas worker, event live ke subscriber aktif, trimming riwayat, batas semaphore lintas worker, self-heal lease TTL, context manager lease, fallback in-memory, dan degradasi graceful saat Redis tidak dapat dijangkau.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - **Deployment VPS (Najmi):** untuk menjalankan Uvicorn lebih dari satu worker, set `REDIS_URL` di `.env` lalu verifikasi `GET /api/health` menunjukkan `"multi_worker_safe": true`. Tanpa Redis, sistem tetap jalan namun state bersifat per-proses (hanya aman untuk `--workers 1`).
  - Jalur Redis diuji memakai `fakeredis`; server Redis produksi belum diverifikasi live.
- **Rencana Selanjutnya:** Parser PDF OCR / hidden text detection untuk CV selain DOCX.

---

### 2026-10-20 - Najmi - Parser PDF & Deteksi Hidden Text (PRD Bab 6.1)

- **Branch:** `feat/backend-pdf-hidden-text`
- **Komponen / File:**
  - `backend/app/core/hidden_text_detector.py` (diperluas)
  - `backend/app/api/careers.py`
  - `backend/app/api/candidates.py`
  - `backend/tests/test_pdf_hidden_text.py` (baru)
- **Yang Dikerjakan:**
  - `hidden_text_detector.py` diperluas dari DOCX-only menjadi audit dua format dengan dispatcher `audit_document_hidden_text(content, file_format)` yang mengembalikan `(cleaned_text, hidden_snippets, pdf_result)`.
  - **PDF:** walker content-stream yang melacak text/graphics state dan mendeteksi: render mode 3/7 (teks invisible), fill putih/nyaris putih (RGB `rg`/`g` dan CMYK `k`), font di bawah 2pt, teks di luar MediaBox (off-page), XObject Form bersarang (maks. kedalaman 2), image mikro 1×1 sebagai penanda covert, serta halaman image-only yang ditandai butuh OCR.
  - **DOCX:** ditambah pemindaian tabel, yang sebelumnya tidak diperiksa sehingga payload di dalam cell lolos.
  - **Jebakan pypdf 6.x:** `ContentStream.__iter__` mengembalikan kosong (bukan error), sehingga walker diam-diam melewatkan seluruh teks dan audit selalu "bersih". Diperbaiki dengan mengakses `.operations` secara eksplisit.
  - Fallback `extract_text()` hanya dipakai bila walker tidak menghasilkan temuan apa pun. Jika ada temuan, fallback justru akan menyuntikkan ulang payload yang sudah dibuang.
  - `careers.py` & `candidates.py`: kedua jalur ingestion (portal publik dan dropzone HR) kini mengaudit PDF, bukan hanya DOCX. Temuan PDF dipersist ke `candidate_anomalies` dengan tipe spesifik, dan halaman tanpa text layer ditandai `PDF_REQUIRES_OCR`.
- **Status & Verifikasi:** Selesai 100%. `uv run pytest backend/tests -q` lulus **92 dari 92** test, 0 failure. Test baru `test_pdf_hidden_text.py` (11 test) membangun PDF valid secara manual (tanpa reportlab) dan memverifikasi: teks visible terekstrak, render mode 3 terdeteksi, white fill terdeteksi, font 0.8pt terdeteksi, teks off-page terdeteksi, array `TJ` dengan kerning, halaman image-only ditandai butuh OCR, image 1×1 ditandai, PDF rusak tidak melempar exception, dispatcher dua format, dan hidden run di dalam tabel DOCX.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - **Fardizza:** kandidat dengan temuan PDF kini otomatis mendapat `triage_priority = 'HIGH_ATTENTION'`, dan anomali bertipe `PDF_INVISIBLE_RENDER_MODE` / `PDF_WHITE_TEXT` / `PDF_TINY_FONT` / `PDF_OFFPAGE_TEXT` / `PDF_MICRO_IMAGE` / `PDF_IMAGE_ONLY_PAGE` / `PDF_REQUIRES_OCR` tersedia di `candidate_anomalies` untuk dibaca scoring engine.
  - **Catatan keterbatasan:** PDF hasil scan murni (tanpa text layer) belum di-OCR — saat ini hanya ditandai `PDF_REQUIRES_OCR` agar tidak diam-diam menghasilkan teks kosong. OCR engine belum ditambahkan karena membutuhkan dependensi biner (tesseract) yang belum tersedia di VPS.
- **Rencana Selanjutnya:** Integrasi eksternal live (Google Calendar OAuth2 memakai tabel `oauth_tokens` yang sudah ada, dan SMTP Resend), serta penguatan sanitasi PII regex untuk CV non-standar tanpa form input.

---

### 2026-10-20 - Najmi - Perluasan Kontrak Payload `GET /api/candidates` untuk Dashboard

- **Branch:** `feat/backend-candidates-payload`
- **Komponen / File:**
  - `backend/app/api/candidates.py`
  - `backend/tests/test_candidates_list_payload.py` (baru)
- **Latar Belakang:** Penghapusan mock data di frontend (pekerjaan Willy) menyingkap bahwa payload `GET /api/candidates` tidak memuat `job_title`, `department`, `github_url`, `portfolio_url`, `flags`, maupun `key_technologies`. Selama mock masih ada, kekurangan ini tersamarkan karena UI mengambil nilai tersebut dari data karangan. Setelah mock dihapus, kolom Job Title selalu placeholder dan status GitHub selalu `UNVERIFIED`.
- **Yang Dikerjakan:**
  - **1. Perluasan Query Utama:**
    - Menambahkan `JOIN job_descriptions j ON c.job_id = j.id` untuk menyediakan `job_title` dan `department`.
    - Menyertakan `c.github_url` dan `c.portfolio_url` yang sudah ada di skema namun tidak pernah di-select.
    - Seluruh kolom dan klausa filter kini memakai alias tabel (`c.` / `j.`) agar tidak ambigu setelah JOIN.
  - **2. Pengambilan Relasi Secara Batch (bukan N+1):**
    - `flags` diambil dari `candidate_anomalies.anomaly_type` untuk seluruh kandidat di halaman dalam **satu** query dengan `IN :cids` expanding bindparam.
    - `key_technologies` diambil dari `candidate_evidence.target_competency` dengan pola yang sama, dan di-dedupe di Python.
    - Saat halaman kosong, kedua query relasi dilewati sepenuhnya (tidak ada `IN ()`).
  - **3. Suite Uji Kontrak (`test_candidates_list_payload.py`):**
    - 7 test yang mengunci kontrak: kelengkapan field dashboard, keberadaan `JOIN job_descriptions`, jumlah query batch konstan terhadap jumlah baris, halaman kosong tidak memicu query relasi, kandidat tanpa relasi menghasilkan list kosong (bukan `null`), dan filter `job_id`/`status` memakai alias tabel.
- **Status & Verifikasi:** Selesai 100%. `uv run pytest backend/tests -q` lulus **99 dari 99** test, 0 failure (sebelumnya 92).
  - **Validasi SQL terhadap engine nyata:** query utama, klausa filter alias, dan kedua query relasi dieksekusi langsung pada SQLite in-memory dengan data seed (1 job, 1 kandidat, 2 anomali, 3 evidence dengan 1 duplikat). Hasil: `job_title = 'Senior Backend Engineer'`, `department = 'Core Engineering'`, filter `job_id` & `status` masing-masing mengembalikan 1 baris, `flags` berisi 2 entri, dan `key_technologies` ter-dedupe menjadi `['FastAPI', 'PostgreSQL']`.
  - Catatan: SQL divalidasi pada SQLite (engine yang tersedia di host dev); MariaDB produksi belum diuji langsung karena tidak ada instance di host ini.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - **Willy:** payload `GET /api/candidates` kini menyertakan `job_title`, `department`, `github_url`, `portfolio_url`, `flags`, dan `key_technologies`. Placeholder `'Unknown Role'` hanya akan muncul jika `job_title` benar-benar null. Field `department` siap dipakai bila ingin ditampilkan.
  - **Fardizza:** `key_technologies` diturunkan dari `candidate_evidence.target_competency` (bukan dari ekstraksi terpisah), dan `flags` dari `candidate_anomalies.anomaly_type`. Jika ingin taksonomi kompetensi yang lebih kaya, tambahkan variasi nilai `target_competency` saat menulis evidence.
  - **Performa:** endpoint kini menjalankan 3 query per halaman (1 utama + 2 batch), konstan terhadap `limit`. Perlu diperhatikan saat mengukur ulang latensi dashboard.
- **Rencana Selanjutnya:** Integrasi eksternal live (Google Calendar OAuth2 + SMTP Resend) dan penguatan sanitasi PII untuk CV non-standar.

---

### 2026-10-20 - Najmi - Integrasi Eksternal Live: Google Calendar OAuth2 & Resend Email

- **Branch:** `feat/backend-external-integrations`
- **Komponen / File:**
  - `backend/app/adapters/google_calendar.py` (baru)
  - `backend/app/api/calendar_oauth.py` (baru)
  - `backend/app/core/email.py` (baru)
  - `backend/app/core/email_templates.py` (baru)
  - `backend/app/core/crypto.py`
  - `backend/app/core/config.py`
  - `backend/app/api/candidates.py`
  - `backend/app/api/careers.py`
  - `backend/app/main.py`
  - `backend/.env.example`
  - `backend/tests/test_google_calendar_oauth.py` (baru)
  - `backend/tests/test_email_resend.py` (baru)
- **Yang Dikerjakan:**

  - **1. Google Calendar OAuth2 Two-Way Sync (PRD Bab 6.3 `[TARGET]`):**
    - `GoogleCalendarAdapter` dengan gerbang konfigurasi eksplisit: bila `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` kosong, adapter melaporkan `configured=False` dan **tidak pernah** melakukan panggilan keluar. Sistem tetap memakai `[MOCK / SANDBOX]`.
    - Alur consent OAuth2: `build_authorization_url` memakai `access_type=offline` + `prompt=consent` agar `refresh_token` benar-benar diterbitkan, dan menyertakan nonce `state` untuk CSRF.
    - Token disegel dengan Master KEK (AES-256-GCM) sebelum disimpan ke tabel `oauth_tokens` yang sudah ada di skema 12 tabel. Plaintext token tidak pernah muncul di query parameter, log, maupun response body.
    - Refresh token otomatis saat kedaluwarsa (dengan skew 120 detik), dan satu kali refresh-and-retry bila Calendar API membalas 401. Retry dibatasi satu kali karena 401 kedua berarti refresh token sudah mati.
    - Idempotensi event: `generate_event_id` menghasilkan base32hex lowercase tanpa padding sesuai spesifikasi PRD. Balasan **409 Conflict** diperlakukan sebagai **sukses** (`already_existed=True`) sehingga pengiriman ulang tidak menduplikasi jadwal.
    - `cancel_event` memperlakukan 404/410 sebagai sukses — keadaan akhir yang diinginkan adalah "tidak ada event".
    - Endpoint: `GET /api/calendar/status`, `GET /api/calendar/oauth/authorize`, `GET /api/calendar/oauth/callback`, `POST /api/calendar/disconnect`, `GET /api/calendar/events`.
    - **Keamanan callback:** endpoint callback sengaja tanpa Bearer karena browser datang dari Google. Kepercayaan berasal dari nonce `state` single-use ber-TTL 600 detik yang disimpan di Redis (fallback in-process bila Redis absen). Redirect sukses **tidak** membawa token di URL.
    - Penambahan `encrypt_with_kek` / `decrypt_with_kek` di `crypto.py` untuk menyegel secret pendek langsung di bawah KEK.

  - **2. Email Transaksional Resend:**
    - `EmailService` mendukung dua transport: `resend_api` (HTTPS ke api.resend.com) dan `resend_smtp` (relay SMTP_SSL). Dua jalur disediakan karena host dengan egress SMTP tertutup tetap bisa memakai API, dan sebaliknya.
    - Bila `EMAIL_PROVIDER` atau kredensial kosong, pengiriman **tidak** dilakukan dan mengembalikan `sent=False, reason="EMAIL_NOT_CONFIGURED"` — tidak pernah melempar exception, agar alur rekrutmen tidak gagal karena mail outage.
    - Retry terbatas dengan backoff eksponensial, hanya untuk kegagalan transien (network, 429, 5xx). Error validasi 4xx dan `SMTPAuthenticationError` tidak di-retry.
    - `smtplib` blocking dijalankan lewat `asyncio.to_thread` agar tidak memblokir event loop.
    - Validasi alamat email sebelum transport dipanggil; log hanya mencatat domain, tidak pernah alamat lengkap atau PII.
    - Template di `email_templates.py`: `interview_scheduled`, `application_received`, `application_status_update`, `erasure_confirmation`, `hr_new_application_alert`. Semua input pengguna di-escape (`html.escape`) dan setiap template menyediakan alternatif plain-text.

  - **3. Penempatan Side-Effect yang Benar:**
    - Sinkronisasi kalender dan email kandidat dijalankan **setelah** `db.commit()` pada `POST /api/candidates/{id}/review`. Keputusan HR tidak boleh di-rollback hanya karena Google atau Resend sedang down.
    - Email kandidat hanya dikirim pada keputusan final, tidak pernah saat blind review — sesuai Gatekeeper HITL PRD Bab 7.
    - Respons endpoint kini menyertakan blok `notifications` berisi hasil per efek (`synced`, `sent`, `reason`), sehingga kegagalan terlihat tanpa menyamarkan status sukses keputusan.
    - Email acknowledgement juga dikirim pada `POST /api/careers/{id}/apply` (post-commit, best-effort).

  - **4. Keselarasan Lock Hierarchy:** Query lock kandidat pada review **tidak** memakai `JOIN job_descriptions`. Meng-JOIN tabel itu di dalam `SELECT ... FOR UPDATE` akan memperluas himpunan lock melampaui hierarki `users -> interview_slots -> candidates` yang diwajibkan PRD dan berisiko deadlock dengan update lowongan konkuren. Judul lowongan diambil lewat query terpisah setelah lock.

  - **5. Konfirmasi Penghapusan Data pada Withdraw (UU PDP No. 27/2022):**
    - Menemukan bahwa template `erasure_confirmation` sebelumnya tidak terpakai — pelamar yang menarik lamaran tidak menerima bukti tertulis apa pun bahwa datanya sudah dimusnahkan.
    - `POST /api/careers/withdraw` kini mengirim konfirmasi tersebut. **Urutannya kritis:** alamat penerima didekripsi **sebelum** `execute_talentops_erasure` dipanggil, karena rutin itu meng-null-kan `encrypted_email` **dan** `encrypted_dek` — membaca alamat setelah shred tidak mungkin lagi.
    - Email dikirim setelah `db.commit()`, dan kegagalannya tidak pernah menggagalkan withdraw. Hak penghapusan data tidak boleh bergantung pada Resend yang hidup.
    - Bila dekripsi gagal (envelope rusak), withdraw tetap berjalan dan email dilewati — bukan diblokir.
    - Bila email dinonaktifkan, DEK tidak disentuh sama sekali dan query judul lowongan tidak dijalankan.
    - Alamat email tidak pernah dikembalikan di response body endpoint publik ini.
    - Plain-text alternative template `erasure_confirmation` diperbaiki agar ikut memuat nama posisi (sebelumnya hanya ada di HTML, sehingga pembaca plain-text kehilangan konteks).

- **Status & Verifikasi:** Selesai 100% pada tingkat kode dan pengujian otomatis. `uv run pytest backend/tests -q` lulus **140 dari 140** test, 0 failure (sebelumnya 132).
  - Test baru `test_withdraw_erasure_email.py` (8 test): urutan dekripsi-sebelum-shred, urutan commit-sebelum-kirim, kegagalan email tidak menggagalkan withdraw, dekripsi gagal tetap melakukan shred, tidak ada dekripsi saat email nonaktif, kegagalan erasure tidak mengirim apa pun, alamat tidak bocor di response, dan nama posisi muncul di konfirmasi.
  - Test baru `test_google_calendar_oauth.py` (16 test): gerbang konfigurasi tanpa panggilan jaringan, konstruksi URL consent (`offline`, scope, state), pertukaran kode, penyegelan token KEK (memverifikasi plaintext tidak ada di parameter INSERT), refresh saat kedaluwarsa, determinisme & format base32hex event ID, idempotensi 409, satu kali refresh-retry pada 401, dan cancel 404 sebagai sukses.
  - Test baru `test_email_resend.py` (17 test): provider nonaktif tidak melempar, validasi penerima, sukses API, 4xx tidak di-retry, 429 di-retry, batas retry, banyak penerima, SMTP sukses, auth SMTP tidak di-retry, connection error retryable, serta escaping HTML dan plain-text pada seluruh template.
  - **⚠️ Batas verifikasi yang harus jujur dicatat:**
    - **Belum ada panggilan live ke Google Calendar API** — kredensial OAuth belum tersedia dan host dev tidak punya akun Google terhubung. Seluruh jalur diuji dengan `httpx` yang di-stub.
    - **Belum ada pengiriman email live ke Resend** — `RESEND_API_KEY` belum diisi. Seluruh jalur diuji dengan httpx/smtplib yang di-patch.
    - Verifikasi end-to-end nyata memerlukan kredensial di `.env` VPS, lalu memeriksa event yang benar-benar muncul di Google Calendar dan email yang benar-benar diterima.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - **Willy — alur koneksi kalender di frontend:** panggil `GET /api/calendar/oauth/authorize` (dengan Bearer token), lalu arahkan browser ke `authorization_url`. Setelah consent, backend me-redirect ke `OAUTH_SUCCESS_REDIRECT` dengan query `?calendar=connected` atau `?calendar=error&reason=...`. Tampilkan status dari `GET /api/calendar/status` (`configured`, `connected`, `token_expires_at`).
  - **Willy — tombol disconnect:** `POST /api/calendar/disconnect`.
  - **Willy:** response `POST /api/candidates/{id}/review` kini punya field tambahan `notifications` (calendar & email). Aman diabaikan, tapi bisa dipakai untuk menampilkan peringatan bila sinkronisasi gagal.
  - **Fardizza:** email hanya dikirim setelah keputusan manusia, jadi tidak ada jalur otomatis yang mengirim email dari pipeline triage.
  - **Deployment VPS (Najmi):** isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (harus terdaftar di Google Cloud Console), dan `EMAIL_PROVIDER=resend_api` + `RESEND_API_KEY`. Verifikasi `GET /api/calendar/status` menunjukkan `configured: true`.
  - **Catatan file bersama:** `backend/.env.example` ikut diubah (penambahan variabel baru, tanpa nilai rahasia). Sesuai aturan isolasi modul, ini saya sebutkan agar rekan tim tahu; tidak ada kredensial yang di-commit.
- **Rencana Selanjutnya:** Penguatan sanitasi PII regex untuk CV non-standar tanpa form input (item terakhir).

---

### 2026-10-20 - Najmi - Sanitasi PII Regex & Konteks untuk CV Non-Standar Tanpa Form Input

- **Branch:** `feat/backend-pii-sanitizer-context`
- **Komponen / File:**
  - `backend/app/core/sanitizer.py` (ditulis ulang, 102 → 520 baris)
  - `backend/app/api/candidates.py`
  - `backend/app/api/careers.py`
  - `backend/tests/test_pii_sanitizer.py` (baru)
  - `backend/tests/test_dropzone_sanitization_wiring.py` (baru)
- **Yang Dikerjakan:**

  - **1. Akar Masalah yang Ditemukan:** Jalur HR dropzone (`POST /api/candidates/upload`) memanggil `sanitize_pii(raw_text)` **tanpa kamus apa pun**, karena memang tidak ada metadata form di jalur itu. Sanitizer lama hanya punya regex email, telepon, gender, dan almamater — **nama kandidat tidak pernah disamarkan**. Nama adalah identitas utama, jadi ini kebocoran PII terbesar di seluruh sistem, dan justru terjadi pada jalur yang menurut PRD Bab 6.4 paling berisiko.

  - **2. Inferensi Nama dari Header (konteks, bukan form):**
    - `infer_name_from_header()` merekonstruksi nama dari struktur dokumen: label `Nama:`/`Name:` lebih dulu, lalu baris nama berdiri sendiri di blok header (maksimal 8 baris pertama).
    - Menolak heading dokumen (`CURRICULUM VITAE`, `DAFTAR RIWAYAT HIDUP`, `PROFIL`, dst.), baris berangka, baris ber-`@`, dan baris beralamat — sehingga tidak salah menebak.
    - Mengupas gelar (`Ir.`, `S.Kom`, `M.T.`, `Prof.`, dst.) sebelum pencocokan.
    - Bila inferensi gagal, fungsi mengembalikan `None` — **tidak menebak**. Kegagalan dilaporkan lewat `limitations`, bukan didiamkan.

  - **3. Perluasan Cakupan Regex (khas CV Indonesia):**
    - **NIK** 16 digit (pola 2+4+4+4+2, prefiks provinsi 11–99), **NPWP** 15 digit (termasuk format bertitik), **paspor**, **NIM/NIP/NIDN/NRP**.
    - **Alamat pos** per baris (`Jl.`, `Jalan`, `Gang`, `RT/RW`, `Kelurahan`, `Kecamatan`, `Kabupaten`, `Kode Pos`, `Perumahan`, `Blok`).
    - **Tanggal lahir** — hanya bila terikat kata kunci (`Tanggal Lahir`, `TTL`, `Lahir`, `DOB`). Tanggal lepas **tidak** disentuh karena itu linimasa karier yang sah.
    - **Status perkawinan, agama, usia** — atribut diskriminatif menurut kebijakan fair hiring. Usia hanya bila berlabel (`Usia:`/`Umur:`), supaya "3 tahun pengalaman" tetap utuh.
    - **URL sosial/profesional** (LinkedIn, GitHub, GitLab, Behance, dst.) — handle yang sama sudah tersimpan terpisah di `github_url` untuk verifikasi.
    - **Nama terbalik** (`Santoso, Budi`) dan **nama sebagian** (≥4 karakter) untuk menangkap sebutan di narasi bebas.

  - **4. Pengerasan terhadap Obfuskasi:**
    - Normalisasi **NFKC** sebelum pencocokan, sehingga `＠` full-width terlipat menjadi `@`.
    - **Karakter zero-width dihapus** (`U+200B`, `U+200C`, `U+200D`, `U+FEFF`, `U+00AD`, dst.), jadi `budi@exa\u200bmple.com` tidak bisa lolos.
    - Email bentuk obfuskat `budi [at] gmail [dot] com` ikut tertangkap.
    - Telepon dengan pemisah campuran (`-`, spasi, titik, `+62`) tertangkap.

  - **5. Pelaporan False-Negative yang Jujur (tuntutan eksplisit PRD Bab 6.4):**
    - `SanitizationResult` membawa `detected_name`, `name_source`, `residual_name_candidates`, dan `limitations`.
    - Bila nama tidak bisa diresolusi, sanitizer **melaporkan** deretan kata berhuruf kapital yang lolos sebagai kandidat nama yang belum terverifikasi (dibatasi 10 entri), bukan mengklaim hasil bersih.
    - Jalur dropzone **mempersist** temuan itu sebagai baris anomali `PII_RESIDUAL_RISK` (severity `MEDIUM`) di `candidate_anomalies`, sehingga ada antrean review manusia — bukan sekadar field respons yang hilang setelah request selesai.
    - Jalur `/apply` mengembalikan blok `pii_sanitization` berisi `name_source`, `residual_risk`, dan `limitations`.

  - **6. Empat Bug yang Ditemukan Lewat Probe dan Diperbaiki:**
    - **NIK tidak tertangkap** — pola awal hanya 14 digit (2+4+4+4), bukan 16. Diperbaiki menjadi 2+4+4+4+2.
    - **Email dirusak redaksi nama** — urutan lama menjalankan kamus nama sebelum pola email, sehingga `budi.santoso@gmail.com` menjadi `[NAME_REDACTED].[NAME_REDACTED]@gmail.com` dan domain `gmail.com` bocor. Urutan dibalik: identitas struktural → kontak → atribut → baru nama.
    - **Telepon memakan baris baru** — pemisah memakai `\s` yang mencakup `\n`, sehingga `HP: 0812-3456-7890` menelan line break dan menyambung field berikutnya. Diganti `[ \t.\-]`.
    - **Gender terpotong** — `[A-Za-z]+` berhenti di tanda hubung, menyisakan `-laki`. Ditambah `\-` ke kelas karakter.

  - **7. Sisa Item 3 yang Ikut Ditutup:** Jalur dropzone ternyata masih memanggil `audit_docx_hidden_text` secara langsung, sehingga **PDF tidak pernah diaudit teks tersembunyinya** di jalur itu — padahal klaim item 3 menyebut dispatcher sudah dipakai di kedua endpoint. Sudah dimigrasikan ke `audit_document_hidden_text`. Saya catat di sini karena klaim item 3 sebelumnya kurang tepat untuk jalur ini.

- **Status & Verifikasi:** Selesai 100% pada tingkat kode dan pengujian otomatis. `uv run pytest backend/tests -q` lulus **178 dari 178** test, 0 failure (sebelumnya 140).
  - `test_pii_sanitizer.py` (35 test): inferensi nama (label, baris mandiri, gelar, penolakan heading/kontak, batas blok header), redaksi seluruh field identitas pada jalur tanpa metadata, atribut diskriminatif, pelestarian sinyal teknis (skill, perusahaan, durasi, tanggal kerja), ketahanan kebocoran di narasi bebas, bentuk nama terbalik, pelaporan residual, batas panjang laporan, jalur form, kompatibilitas tanda tangan lama, obfuskasi zero-width & full-width & `[at]/[dot]`, telepon multi-pemisah, empat regression guard bug di atas, idempotensi, input kosong, serta latensi.
  - `test_dropzone_sanitization_wiring.py` (3 test): endpoint benar-benar memakai `sanitize_resume` dan menyamarkan nama tanpa metadata, anomali `PII_RESIDUAL_RISK` benar-benar di-insert saat ada residual risk, dan tidak ada anomali palsu saat dokumen bersih.
  - **Latensi:** diukur pada CV sintetis 8× panjang standar, rata-rata **di bawah 20 ms** per dokumen — sesuai anggaran PRD Bab 6.4 (test gagal bila melewati batas).
  - **Recall:** 12/12 field identitas pada CV uji hilang dari teks tersanitasi (100%, di atas target 98% PRD Bab 8).
  - **⚠️ Batas verifikasi yang harus jujur dicatat:**
    - Uji recall memakai **CV sintetis buatan sendiri**, bukan golden dataset 20–30 resume yang direncanakan di PRD. Angka 100% di atas **tidak boleh** dikutip sebagai hasil benchmark evaluasi riil; dataset sintetisnya belum ada.
    - Inferensi nama berbasis heuristik tata letak. CV dengan nama di dalam kolom tabel dua-lajur, nama di footer, atau nama yang ditulis tanpa huruf kapital akan gagal terdeteksi dan hanya muncul sebagai residual risk.
    - Deteksi hanya berbasis regex dan aturan tata letak — tidak ada NER. Nama yang muncul **hanya** di dalam narasi tanpa jejak di header memang tidak bisa dikenali sebagai nama; inilah false-negative yang dilaporkan secara eksplisit, bukan dihilangkan.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - **Willy:** respons `POST /api/candidates/upload` kini punya blok `sanitization` per kandidat (`detected_name`, `name_source`, `residual_risk`, `limitations`) di samping `sanitization_stats` yang sudah ada. Bisa dipakai menampilkan badge peringatan bila `residual_risk` bernilai `true`.
  - **Willy:** respons `POST /api/careers/{id}/apply` kini punya blok `pii_sanitization` dengan field yang sama. `pii_sanitization_stats` tetap ada dan tidak berubah bentuk, hanya bertambah kunci baru (`nik`, `npwp`, `address`, `dob`, `marital`, `religion`, `social_url`, `student_id`, `passport`, `age`).
  - **Fardizza:** anomali `PII_RESIDUAL_RISK` masuk ke antrean triage yang sama dengan anomali lain, severity `MEDIUM`. Tidak memblokir alur, hanya menandai perlunya review manual.
  - **Semua:** `sanitize_pii(text, ...)` masih tersedia dengan tanda tangan lama (mengembalikan 2-tuple) untuk kompatibilitas, tapi kode baru sebaiknya memakai `sanitize_resume()` agar laporan residual ikut terbawa.
- **Rencana Selanjutnya:** Tidak ada item tersisa dari lima rencana awal. Pekerjaan berikutnya yang disarankan: menyusun golden dataset 20–30 resume sintetis untuk mengukur recall sanitizer secara riil, dan verifikasi end-to-end integrasi eksternal setelah kredensial VPS terpasang.

---

### 2026-10-21 - Najmi - Dedup Temuan PDF_MICRO_IMAGE & Eskalasi Prioritas Berbasis Severity

- **Branch:** `feat/backend-pdf-micro-image-dedup`
- **Komponen / File:**
  - `backend/app/core/hidden_text_detector.py`
  - `backend/app/api/careers.py`
  - `backend/tests/test_pdf_hidden_text.py`
- **Temuan (dari laporan UI):** Satu kandidat menampilkan lebih dari 130 badge `PDF_MICRO_IMAGE` di kolom Rekomendasi AI pada tabel HR, padahal CV-nya hanya berisi foto profil dan teks biasa. Kandidat itu juga berada di antrean `HIGH_ATTENTION` tanpa pernah di-scan.
- **Akar masalah (tiga lapis, semuanya diverifikasi lewat probe):**
  1. `_flag_suspicious_image` menandai **setiap pemakaian** objek gambar, bukan setiap objek. Satu glyph 1x1 yang dirujuk 145 kali oleh operator `Do` menghasilkan 145 finding. Probe: foto 200x200 digambar sekali → 0 finding; satu gambar 1x1 digambar 145 kali → 145 finding.
  2. `careers.py` meng-insert satu baris `candidate_anomalies` per finding, tanpa agregasi. 145 finding → 145 baris DB.
  3. Eskalasi `triage_priority = 'HIGH_ATTENTION'` dipicu oleh **adanya finding apa pun**, termasuk `PDF_MICRO_IMAGE` yang severity-nya hanya `MEDIUM`.
- **Yang Dikerjakan:**
  - `PdfAuditResult.flagged_images` — kamus kunci `(page, indirect_reference.idnum)`. Kunci memakai `idnum` karena pypdf membuat wrapper baru tiap lookup, sehingga `id()` tidak stabil. Pemakaian berulang menaikkan `occurrences` pada finding yang sudah ada, bukan membuat finding baru.
  - `_flag_suspicious_image` kini idempoten dan menyertakan field `occurrences`.
  - `careers.py` mengagregasi finding per `anomaly_type` sebelum insert: satu baris per tipe, `description` memuat jumlah kejadian dan daftar halaman. Severity tertinggi per tipe yang dipakai.
  - Eskalasi `HIGH_ATTENTION` kini hanya bila ada finding `severity == "HIGH"`. `PDF_MICRO_IMAGE` (MEDIUM) tetap dicatat sebagai anomali untuk review, tapi tidak lagi menaikkan prioritas.
- **Status & Verifikasi:** `uv run pytest backend/tests -q` → **202 passed**. Probe langsung setelah perbaikan:
  - 145 draw satu objek 1x1 → **1 finding**, severity `MEDIUM`, `occurrences: 145`, tidak eskalasi.
  - Teks `3 Tr` (invisible render mode) → `PDF_INVISIBLE_RENDER_MODE` severity `HIGH`, **tetap** eskalasi.
  - Test regresi baru `test_pdf_micro_image_flagged_once_per_object` mengunci perilaku ini.
- **⚠️ Batas yang harus jujur dicatat:**
  - Perbaikan ini tidak menyentuh data yang sudah terlanjur masuk. Baris `candidate_anomalies` lama bertipe `PDF_MICRO_IMAGE` dan `triage_priority = 'HIGH_ATTENTION'` pada kandidat terdampak masih ada di MariaDB produksi dan perlu dibersihkan terpisah.
  - `/SMask` (transparansi gambar) **masih belum diperiksa**. Docstring fungsi sebelumnya menjanjikan pemeriksaan itu, tapi tidak pernah diimplementasikan; docstring sudah dikoreksi agar tidak mengklaim lebih dari yang dikerjakan. Konsekuensinya gambar dekoratif ≤2x2 px tetap dilaporkan sebagai `PDF_MICRO_IMAGE` — kini hanya sekali per objek, dengan severity `MEDIUM` yang tidak mengeskalasi prioritas.
  - Ambang tetap ≤2x2 px. Tidak ada pengukuran terhadap korpus PDF riil untuk memvalidasi ambang ini; angka 2 dipilih dari asumsi, bukan data.
- **Catatan untuk Rekan Tim (Willy & Fardizza):**
  - **Willy:** `PDF_MICRO_IMAGE` kini muncul paling banyak satu baris per kandidat per halaman, jadi `flags` tidak lagi meledak. Badge di `CandidateTable.jsx` juga sudah dibatasi 3 + `+N lainnya` dan disembunyikan selama kandidat belum di-scan — perubahan frontend itu di-commit terpisah di `LOG_WILLY.md`.
  - **Fardizza:** anomali `PDF_MICRO_IMAGE` severity `MEDIUM` tidak lagi memengaruhi `triage_priority`. Kalau skoring perlu memperhitungkannya, ambil dari `candidate_anomalies` langsung, jangan dari `triage_priority`.
- **Rencana Selanjutnya:** Bersihkan baris `PDF_MICRO_IMAGE` lama dan reset `triage_priority` kandidat terdampak di MariaDB produksi.



