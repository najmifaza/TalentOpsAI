# Status Pekerjaan Backend — Apa yang Belum Selesai

**Terakhir diperbarui:** 21 Oktober 2026 (revisi kelima)
**Branch acuan:** `main` @ `54cf1e4`
**Status pengujian:** `pytest backend/tests -q` → **220 passed, 0 failed**

Dokumen ini mendaftar pekerjaan yang **belum** selesai setelah lima item penguatan backend
(auth/RBAC, Redis multi-worker, PDF hidden-text, integrasi eksternal, sanitasi PII).

Ringkasan singkat: kelima item selesai di tingkat kode dan lulus seluruh test otomatis.
**Item 1 sudah aktif dan terverifikasi di produksi**, item 3 dan item 5 siap produksi.
Item 2 **dibatalkan atas keputusan pemilik sistem** (tanpa Redis, 1 worker — lihat §2).
Item 4 belum pernah menyentuh penyedia eksternal sama sekali.

**Perubahan sesi ini:** §1.1, §1.2, §1.3, dan §3.3 selesai; backend sudah di-deploy dan
diverifikasi live; seed password diperbaiki; domain frontend dipindahkan ke `talentops.ai.id`
(tertunda di sisi Vercel, lihat §5).

**Revisi kedua (sesi yang sama):** §4 selesai seluruhnya — tiga fitur backend yang sebelumnya
tidak terlihat di UI kini tersambung (laporan sanitasi PII, status notifikasi keputusan, panel
Google Calendar). Ditemukan dan diperbaiki bug produksi yang tidak tercatat di revisi pertama:
satu CV bersih menampilkan 130+ badge `PDF_MICRO_IMAGE` (§3.5). Data lama di MariaDB produksi
sudah dibersihkan — 398 baris, 0 tersisa (§5.1).

**Revisi ketiga:** pembersihan produksi selesai dan diverifikasi. Satu klaim di revisi kedua
dikoreksi: anomali palsu itu **tidak** menaikkan `triage_priority` kandidat mana pun (§3.5).

**Revisi keempat:** Evidence Graph diperbaiki agar sinkron dengan isi CV dan anomalinya
berbahasa manusia (§6), lalu tiga cacat susulan ditemukan dari laporan operator VPS dan
diperbaiki berurutan (§6.4). Pengerasan keamanan VPS juga dilakukan — port 3306 ditutup dari
publik dan dua password database dirotasi (§7). Seluruh kandidat sudah di-triage ulang; tidak
ada lagi yang jatuh ke heuristic fallback.

**Revisi kelima:** tiga pekerjaan murni kode yang sebelumnya tidak ada di daftar ini selesai
(§8) — What-If Simulation Studio UI, pembersih slot `tentative` periodik, dan banner data
sintetis. Satu klaim kepatuhan dikoreksi: sifat append-only tabel audit ditegakkan oleh
konvensi kode, **bukan** oleh `REVOKE` di level database (§8.3). Kalimat "tidak ada lagi
pekerjaan murni kode" pada revisi ketiga karena itu tidak berlaku lagi.

---

## 1. Lubang Keamanan — Harus Ditutup Sebelum Apa Pun

> **Status bagian ini: SELESAI (21 Oktober 2026).** Ketiga lubang ditutup dalam satu
> perubahan; uraian di bawah dipertahankan sebagai catatan temuan awal dan diganjal dengan
> blok **Perbaikan yang diterapkan**.

### 1.1 `GET /api/candidates/stream/{candidate_id}` tanpa autentikasi sama sekali

**Berkas:** `backend/app/api/candidates.py:728-746`
**Tingkat:** Kritis

Endpoint SSE ini tidak memiliki `require_roles`, tidak memerlukan Bearer token, dan tidak
memerlukan tiket. `candidate_id` adalah integer berurutan, sehingga siapa pun yang dapat
menjangkau backend bisa berlangganan trace eksekusi triase kandidat mana pun hanya dengan
menebak angkanya — termasuk isi penalaran agen atas CV kandidat tersebut.

Item 1 melewatkan endpoint ini karena hanya 12 endpoint utama yang diamankan; dua endpoint
SSE di bagian bawah berkas tidak tersentuh.

**Yang memperburuk:** frontend justru memakai endpoint yang tidak aman ini.
`frontend/src/components/AgentTraceModal.jsx:188` memanggil
`/api/candidates/stream/${candidateId}` lewat `EventSource`, bukan `trace-stream` yang
bertiket. Jalur aman (`POST /{id}/sse-ticket` → `GET /{id}/trace-stream`, dengan validasi
burn-on-read) sudah dibangun dan teruji, tetapi tidak dipakai oleh UI — itulah sebabnya
kekurangan ini tidak terdeteksi lebih awal.

**Perbaikan yang disarankan:** tambahkan guard pada endpoint, atau hapus endpoint tersebut
dan pindahkan frontend ke alur tiket. Opsi kedua lebih bersih karena menghilangkan dua jalur
SSE paralel yang hanya berbeda pada tingkat keamanannya.

**Perbaikan yang diterapkan:** alias dipertahankan tetapi kini **wajib tiket** — tanpa
`?ticket=` mengembalikan 401 `MISSING_SSE_STREAM_TICKET`, tiket palsu/terpakai 403
`INVALID_OR_EXPIRED_SSE_TICKET`, dan endpoint disembunyikan dari OpenAPI
(`include_in_schema=False`) agar tidak diiklankan. Frontend dipindahkan ke alur tiket:
`POST /api/candidates/{id}/sse-ticket` → `EventSource(.../trace-stream?ticket=...)`
(`frontend/src/components/AgentTraceModal.jsx:188`). Respons `POST /{id}/triage` kini
mengembalikan `stream_url` bertiket plus field `sse_ticket_endpoint`. Dijaga
`backend/tests/test_sse_stream_guard.py` (7 test).

---

### 1.2 `DEMO_MODE=True` mematikan seluruh penegakan RBAC

**Berkas:** `backend/app/core/config.py:43` (nilai default) dan `backend/.env:35` (aktif,
dengan `APP_ENV="development"`)

Selama `DEMO_MODE` menyala, `get_current_user` mengembalikan pengguna demo recruiter `id=1`
ketika tidak ada Bearer token. Konsekuensinya seluruh matriks RBAC pada item 1 **tidak
menegakkan apa pun** pada konfigurasi default: setiap request tanpa token diperlakukan
sebagai recruiter yang sah.

Test yang ada tetap hijau justru karena perilaku ini. Jangan menganggap 178 test lulus
sebagai bukti RBAC bekerja.

**Perbaikan yang disarankan:** set `DEMO_MODE=False`, lalu perbaiki test yang bergantung pada
fallback tersebut agar memakai token sungguhan.

**Perbaikan yang diterapkan:** `DEMO_MODE=False` di `backend/app/core/config.py:43` (default),
`backend/.env`, dan `backend/.env.example` (dengan komentar peringatan bahwa mode ini mematikan
RBAC). Empat test di `backend/tests/test_sprint5_features.py` yang bergantung pada fallback
diperbaiki memakai Bearer token asli (`admin`/`recruiter`/`compliance_officer`), sehingga kini
menguji matriks RBAC sungguhan. Ditemukan pula bug nyata saat perbaikan ini: baris `users`
parsial dari DB menimpa klaim token sehingga `role` menjadi `None` — diperbaiki di
`backend/app/core/auth.py:152`.

---

### 1.3 Frontend belum memiliki autentikasi apa pun

**Cakupan:** 15 komponen di `frontend/src/`

- Pencarian `Authorization` → **0 hasil**
- Pencarian `auth/login` atau `/api/auth` → **0 hasil**
- Tidak ada halaman login, tidak ada penyimpanan token, tidak ada refresh

Artinya, meskipun `DEMO_MODE=False` dinyalakan, UI akan langsung gagal karena tidak ada cara
memperoleh token. Item 1 dan item 1.3 saling mengunci: keduanya harus dikerjakan bersamaan.

Backend sudah menyediakan `POST /api/auth/login` dan `GET /api/auth/me`.

**Perbaikan yang diterapkan:**

- `frontend/src/lib/api.js` — penyimpanan token (`talentops_token`), `login()`, `logout()`,
  `fetchMe()`, `issueSseTicket()`, plus **interceptor `window.fetch` sekali pasang** yang
  menempelkan `Authorization: Bearer <jwt>` ke setiap panggilan ke `API_BASE_URL`. Semua 15
  komponen ikut terlindungi tanpa perlu disentuh satu per satu.
- Respons `401` dari backend otomatis menghapus sesi dan mengalihkan ke halaman login.
- `frontend/src/components/LoginPage.jsx` — form login di route `/admin/login`.
- `frontend/src/App.jsx` — seluruh `/admin/*` dibungkus `RequireAuth`; tanpa token langsung
  dialihkan ke `/admin/login`.
- `frontend/src/components/Header.jsx` — indikator user/role aktif dan tombol keluar.

Portal pelamar publik (`/`, `/apply`, `/track`) tetap tanpa login karena endpoint `careers`
memang publik. `npm run build` lulus, chunk `LoginPage` terpisah (3,42 kB).

Syarat operasional baru: `DEMO_MODE=False` berarti tabel `users` harus terisi. Seed tersedia
di `backend/scripts/seed_data.py`.

---

## 2. Sudah Teruji, Belum Pernah Dijalankan Secara Nyata

Seluruh jalur di bawah ini dibuktikan dengan stub, mock, atau `fakeredis`. Tidak satu pun
pernah berbicara dengan layanan sesungguhnya.

| Integrasi | Bukti yang ada | Yang belum ada |
|---|---|---|
| Google Calendar OAuth2 | 16 test dengan `httpx` di-stub | `GOOGLE_CLIENT_ID`/`SECRET` tidak ada di `backend/.env`; nol panggilan nyata |
| Resend (email) | 17 test dengan httpx/smtplib di-patch | `RESEND_API_KEY` tidak ada di `backend/.env`; nol email terkirim |
| ~~Redis multi-worker~~ | 10 test dengan `fakeredis` | **Dibatalkan** — lihat catatan di bawah |
| MariaDB | SQL divalidasi ke SQLite in-memory | Produksi sudah tersambung (`database: connected`), tetapi test suite masih memakai SQLite in-memory |

**Catatan Redis — dibatalkan atas keputusan pemilik sistem.** Redis tidak dipasang; alasan
yang diberikan adalah beban resource di VPS. Konsekuensi yang harus diterima, bukan
diperdebatkan:

- `state_backend` tetap `in-memory`, `multi_worker_safe` tetap `false`.
- Uvicorn **wajib 1 worker**. Dengan `--workers N > 1`, tiket SSE yang diterbitkan worker A
  tidak dikenal worker B (stream menggantung tanpa error), dan budget konkurensi triase
  menjadi `N × TRIAGE_CONCURRENCY_LIMIT`.
- Verifikasi wajib setiap kali service diubah:
  `systemctl cat talentops-backend | grep -i exec` — pastikan tidak ada `--workers 2`.

Kode Redis di `app/core/state.py` dan `app/core/broadcaster.py` **dibiarkan** sebagai jalur
fallback opsional: tanpa `REDIS_URL` ia tidak aktif dan tidak menambah beban. Menghapusnya
akan membuang jalur scale-out yang sudah teruji tanpa memberi keuntungan operasional.

---

## 3. Batas Fungsional yang Tidak Akan Hilang Sendiri

### 3.1 PDF hanya mendeteksi teks tersembunyi, tidak mengekstrak OCR

Halaman hasil pindaian menghasilkan `requires_ocr=True` dengan teks kosong. Kandidat yang
mengirim PDF scan tidak akan memiliki teks untuk dievaluasi sama sekali.

Ini batas yang disengaja pada item 3 — deteksi anomali, bukan transkripsi — tetapi berarti
sebagian berkas akan masuk antrean tanpa konten yang bisa dinilai.

### 3.2 Sanitizer berbasis regex, tanpa NER

Nama yang muncul **hanya** di dalam narasi bebas tanpa jejak apa pun di header tidak dapat
dikenali sebagai nama. Sistem melaporkannya sebagai anomali `PII_RESIDUAL_RISK` alih-alih
menyembunyikannya, sesuai tuntutan PRD Bab 6.4. Ini batas teknologi, bukan bug yang bisa
ditambal dengan regex tambahan.

### 3.3 Recall sanitizer pada golden dataset — SUDAH DIUKUR

**Status: selesai.** Diukur oleh `backend/tests/test_sanitizer_golden_dataset.py` (7 test).

Hasil ukur pada 25 CV riil di `backend/data/golden_dataset/`, memakai jalur **dropzone tanpa
metadata apa pun** (`sanitize_resume(text)` — nama harus diinferensi dari header, bukan
diberikan lewat form):

| Metrik | Hasil |
|---|---|
| Recall entitas PII | **100% (90/90 entitas)** — ambang PRD ≥ 98% |
| Nama terinferensi benar dari header | 25/25 CV, `name_source=header_inference` |
| Residual name candidate | 0 pada seluruh 25 CV |
| Token teknis hancur | 0 (FastAPI, PostgreSQL, Docker, Redis, Kubernetes, Python, dll.) |
| Latensi (dokumen riil, rata-rata 793 karakter) | mean **0,884 ms**, p95 **1,340 ms**, max 1,673 ms |
| Jalur DOCX end-to-end (bytes → parser → sanitizer) | identitas teredaksi, sinyal teknis utuh |

Cara ground truth dibangun tanpa sirkularitas: nama diambil dari **slug nama berkas**
(`cv_01_budi_santoso` → "Budi Santoso", hanya diterima bila cocok dengan baris pertama
dokumen), email/telepon/universitas/URL diambil dari header dan badan dokumen, lalu tiap
entitas diperiksa **kelangsungannya** di output dengan pencocokan substring biasa. Pola regex
sanitizer tidak dipakai untuk menentukan ground truth.

Catatan: dataset memakai nomor telepon yang sudah dimasking (`+628****7890`), sehingga
pengukuran telepon menguji pola yang ada di korpus, bukan nomor lengkap. Pengukuran nomor
lengkap tetap ditangani `test_benchmark_sprint4.py` dengan entitas sintetis.

Sisa batas yang tetap berlaku ada di §3.2 (tanpa NER): nama yang hanya muncul di narasi bebas
tanpa jejak di header tetap dilaporkan sebagai `PII_RESIDUAL_RISK`, bukan ditebak.

### 3.4 Kandidat dari jalur dropzone tidak dapat dihubungi

**Berkas:** `backend/app/api/candidates.py:381-382`

```python
enc_name = encrypt_pii(f"Applicant-{file.filename}", candidate_dek)
enc_email = encrypt_pii("hr_dropzone_upload@talentops.internal", candidate_dek)
```

Nama dan email adalah placeholder. Akibatnya, untuk kandidat yang masuk lewat unggahan
batch HR:

- Email keputusan review akan dikirim ke alamat internal fiktif, bukan ke pelamar
- Unmask PII tidak menampilkan identitas sebenarnya
- Nama di UI hanya berupa nama berkas

Ini bertentangan dengan semangat item 5 (sanitasi PII): nama kini berhasil diredaksi dari
teks CV, tetapi identitas aslinya tidak pernah tersimpan, sehingga tidak ada yang bisa
dibuka kembali secara sah.

### 3.5 `PDF_MICRO_IMAGE` membanjiri antrean — SELESAI (kode + data)

**Status: perbaikan kode selesai dan teruji, baris lama di MariaDB produksi sudah dibersihkan
(21 Oktober 2026, lihat §5.1).**

Gejala yang dilaporkan dari UI: satu kandidat (`#TK-5FF482`) menampilkan **130+ badge
`PDF_MICRO_IMAGE`** di kolom Rekomendasi AI, padahal CV-nya hanya berisi foto profil dan teks
biasa.

> **Koreksi klaim awal.** Dugaan pertama menyebut kandidat itu juga sudah masuk antrean
> `HIGH_ATTENTION` sebelum di-scan. Pengecekan DB membantahnya: #16 dan #17 sama-sama
> `STANDARD` sepanjang waktu. Anomali palsu ini mencemari tampilan dan isi tabel, **bukan**
> urutan antrean. Poin 3 di bawah tetap bug nyata di kode, tetapi tidak pernah terpicu pada
> data yang ada karena tidak ada CV yang menghasilkan finding `HIGH` palsu.

Tiga akar masalah, semuanya dibuktikan lewat probe langsung ke detector:

1. `_flag_suspicious_image` (`backend/app/core/hidden_text_detector.py`) menandai **setiap
   pemakaian** objek gambar, bukan setiap objek. Satu glyph 1×1 yang dirujuk 145 kali oleh
   operator `Do` menghasilkan 145 finding. Probe: foto 200×200 digambar sekali → 0 finding;
   satu gambar 1×1 digambar 145 kali → **145 finding**.
2. `careers.py` meng-insert satu baris `candidate_anomalies` per finding tanpa agregasi.
   145 finding → 145 baris DB → 145 badge.
3. Eskalasi `triage_priority = 'HIGH_ATTENTION'` dipicu oleh **adanya finding apa pun**,
   termasuk `PDF_MICRO_IMAGE` yang severity-nya hanya `MEDIUM`.

Perbaikan yang diterapkan (commit `550998e`, frontend `bef5f7c`):

- `PdfAuditResult.flagged_images` — finding dikunci per `(page, indirect_reference.idnum)`.
  Kunci memakai `idnum` karena pypdf membuat wrapper baru tiap lookup sehingga `id()` tidak
  stabil. Pemakaian berulang menaikkan `occurrences`, bukan menambah finding.
- `careers.py` mengagregasi satu baris per `anomaly_type`; `description` memuat jumlah kejadian
  dan daftar halaman.
- Eskalasi `HIGH_ATTENTION` hanya untuk finding `severity == "HIGH"`.
- `CandidateTable.jsx` — badge anomali disembunyikan selama kandidat belum di-scan, dibatasi
  3 + `+N lainnya`.
- Test regresi `test_pdf_micro_image_flagged_once_per_object`.

Verifikasi setelah perbaikan: 145 draw → **1 finding** (`occurrences: 145`, `MEDIUM`, tidak
eskalasi); teks `3 Tr` → `PDF_INVISIBLE_RENDER_MODE` `HIGH`, **tetap** eskalasi.

**Batas yang masih berlaku:**

- `/SMask` (transparansi gambar) **belum diperiksa**. Docstring lama menjanjikan pemeriksaan itu
  padahal tidak pernah diimplementasikan; docstring sudah dikoreksi. Gambar dekoratif ≤2×2 px
  tetap dilaporkan, kini hanya sekali per objek dengan severity `MEDIUM`.
- Ambang ≤2×2 px dipilih dari asumsi, belum divalidasi terhadap korpus PDF riil.
- ~~Data lama tidak tersentuh.~~ **Sudah dibersihkan** — 398 baris dihapus, 0 tersisa (§5.1).
  Ternyata `triage_priority` palsu tidak pernah terjadi: #16 dan #17 sudah `STANDARD`.

---

## 4. Frontend — SUDAH TERSAMBUNG (21 Oktober 2026)

> **Status bagian ini: SELESAI.** Ketiga fitur yang sebelumnya hanya ada di backend kini dipakai
> UI, dan build lulus. Uraian awal dipertahankan sebagai catatan temuan.

Pencarian awal di `frontend/src` menunjukkan fitur backend yang tidak terlihat pengguna:

| Fitur backend | Hasil pencarian awal | Dampak |
|---|---|---|
| `calendar` | 0 hasil | Endpoint `status`/`oauth/authorize`/`disconnect` ada, UI-nya tidak ada |
| `notifications` | 0 hasil | Field baru pada respons review tidak dibaca |
| `residual_risk` | 0 hasil | Badge peringatan PII belum dibuat |
| `sanitization` | 2 hasil | Hanya `sanitization_stats` lama; blok `sanitization`/`pii_sanitization` baru belum dipakai |

**Perbaikan yang diterapkan:**

- `frontend/src/components/UploadCandidateModal.jsx` — membaca blok `sanitization` dari respons
  `POST /api/candidates/upload`. Modal tidak langsung tertutup; ditampilkan badge
  `PII_RESIDUAL_RISK` (amber) atau "Sanitasi PII bersih" (hijau) beserta `detected_name`,
  `name_source`, dan daftar `limitations`.
- `frontend/src/components/CandidateModal.jsx` — membaca `notifications.calendar` dan
  `notifications.email` dari respons `POST /{id}/review` lewat komponen `DeliveryReport`,
  ditampilkan pada receipt approve maupun reject. `Event ID` kini memakai `event_id` asli dari
  server bila tersedia, bukan lagi ID hasil generate lokal.
- `frontend/src/components/CalendarPanel.jsx` (baru) + rute `/admin/calendar` —
  `GET /api/calendar/status`, connect via `GET /oauth/authorize`, disconnect via
  `POST /disconnect`, plus penanganan pesan hasil callback OAuth.
- `frontend/src/App.jsx` — `/admin/dashboard?calendar=…` (target `OAUTH_SUCCESS_REDIRECT`)
  dialihkan ke `/admin/calendar` agar hasil OAuth tidak hilang.
- `frontend/src/components/Sidebar.jsx` — item menu "Kalender".

Verifikasi: `npm run build` lulus, chunk `CalendarPanel` terpisah (7,23 kB).

**Sisa keterbatasan:** panel akan menampilkan "Server belum dikonfigurasi" sampai
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` diisi — lihat §2 dan §5. Alur connect/disconnect dan
tampilan laporan belum pernah diuji terhadap Google sungguhan.

---

## 5. Operasional & Deployment

**Sudah terverifikasi live (21 Oktober 2026).** Backend di `main` sudah ter-deploy di VPS dan
diuji dari luar:

| Cek | Hasil |
|---|---|
| `GET /api/health` | `database: connected`, `demo_mode: false`, `state_backend: in-memory` |
| `GET /api/candidates/stream/1` tanpa tiket | 401 dalam 0,26 s (tidak lagi menggantung) |
| `GET /api/auth/me` tanpa token | 401 `NOT_AUTHENTICATED_MISSING_TOKEN` |
| `POST /api/auth/login` kredensial salah | 401 `INVALID_CREDENTIALS` (query DB jalan) |
| `POST /{id}/sse-ticket` + Bearer | tiket UUID terbit |
| `GET /trace-stream?ticket=…` | 200 |
| tiket sama dipakai ulang | 403 |
| tiket dipakai untuk `candidate_id` lain | 403 |

Frontend juga sudah ter-deploy lewat CI/CD Vercel: bundle live
`assets/index-QB1QdiDM.js` identik dengan build lokal, memuat chunk `LoginPage`,
`api/auth/login`, `sse-ticket`, `trace-stream`, dan **nol** referensi ke
`candidates/stream` yang lama. CSP `connect-src` mengizinkan domain API.

**Yang masih terbuka:**

- ~~Pembersihan data lama `PDF_MICRO_IMAGE`~~ — **SELESAI 21 Oktober 2026.** Lihat blok di bawah.

- **Password produksi.** Seed default `AdminSecret2026!` (tertulis terbuka di repo) sudah
  diganti; verifikasi: password lama dan default sama-sama 401. Rotasi memakai
  `SEED_ADMIN_PASSWORD` (lihat `backend/scripts/seed_data.py`). Jangan pernah menjalankan seed
  produksi tanpa variabel itu.
- **Domain `talentops.ai.id` tertunda di sisi Vercel.** Kode sudah dipindah (canonical,
  `og:url`, `CORS_ORIGINS`, `EMAIL_FROM`, `OAUTH_SUCCESS_REDIRECT`, regex CORS), tetapi Vercel
  menolak meng-attach domain: `This domain is linked to another Vercel account`, dan Vercel
  meminta TXT di `_vercel.ai.id` — zona PANDI yang tidak bisa ditulis karena
  `talentops.ai.id` adalah pendaftaran langsung di bawah `.ai.id`, bukan subdomain `ai.id`.
  DNS sendiri sudah benar (`A @ → 76.76.21.21`, `CNAME www`/`career → …vercel-dns-017.com`,
  3 TXT verify tersedia), namun ketiga host balas `DEPLOYMENT_NOT_FOUND`. Status: menunggu
  Vercel support melepas stale claim. Situs produksi sementara tetap
  `https://talentops.fawt.biz.id`.
- `mail` dan `ftp` masih CNAME ke apex, jadi ikut menunjuk Vercel. `mail` harus diarahkan ke
  host mail sebenarnya atau dihapus; `ftp` tidak dipakai.
- Record email untuk `talentops.ai.id` (SPF/DKIM Resend, MX) belum ada sama sekali.
- Variabel lingkungan pada `backend/.env.example` (`GOOGLE_*`, `RESEND_*`, `EMAIL_*`,
  `REDIS_*`, `OAUTH_SUCCESS_REDIRECT`) belum diisi di `.env` mana pun. `REDIS_*` tidak akan
  diisi (lihat §2).

### 5.1 Pembersihan `PDF_MICRO_IMAGE` di produksi — SELESAI

Dijalankan 21 Oktober 2026 pada `talentops_db`. SQL awal yang sempat ditulis di dokumen ini
**salah** dan tidak dipakai: filternya menghardcode `anomaly_type IN ('PROMPT_INJECTION',
'HIDDEN_TEXT')`, sehingga tipe `HIGH` lain (`PDF_INVISIBLE_RENDER_MODE`, `PDF_WHITE_TEXT`,
`PDF_ENCRYPTED`) tidak terlindungi dari reset. Versi yang dijalankan memakai filter severity:

```sql
CREATE TABLE candidate_anomalies_bak_20261021 AS
  SELECT * FROM candidate_anomalies WHERE anomaly_type = 'PDF_MICRO_IMAGE';

DELETE FROM candidate_anomalies WHERE anomaly_type = 'PDF_MICRO_IMAGE';

UPDATE candidates c
   SET c.triage_priority = 'STANDARD'
 WHERE c.triage_priority = 'HIGH_ATTENTION'
   AND c.recommendation IS NULL
   AND NOT EXISTS (
         SELECT 1 FROM candidate_anomalies a
          WHERE a.candidate_id = c.id AND a.severity = 'HIGH'
       );
```

Hasil:

| Cek | Hasil |
|---|---|
| Baris diamankan ke `candidate_anomalies_bak_20261021` | 398 |
| Baris `PDF_MICRO_IMAGE` terhapus | 398 (0 tersisa) |
| `UPDATE` jaring pengaman | **0 baris** — no-op |
| Kandidat #16 (`#TK-5FF482`) anomali tersisa | 0 (bersih total) |
| Kandidat #17 (`#TK-2FD8DC`) anomali tersisa | `CONCURRENT_FULLTIME_OVERLAP_23_MONTHS` (HIGH) — sah |
| Kandidat #4 (`#TK-D99A12`) | `HIGH_ATTENTION` + `PROMPT_INJECTION` tetap utuh |

> **Catatan revisi keempat:** anomali #17 kini bertipe `CONCURRENT_FULLTIME_OVERLAP` tanpa angka
> di kode, dengan deskripsi "24 bulan". Angka 23 pada tabel di atas adalah rekaman saat
> pembersihan 21 Oktober; perbaikan hitungan dan triage ulang mengoreksinya menjadi 24 (§6.4).

Temuan penting: **eskalasi `triage_priority` palsu ternyata tidak pernah terjadi.** #16 dan #17
sudah `STANDARD` sebelum pembersihan, jadi `UPDATE` memang no-op — bukan karena filter bekerja,
tapi karena tidak ada yang perlu diperbaiki. Yang benar-benar merusak hanya 398 baris sampah
(199 per kandidat) yang membanjiri badge UI.

`overall_score`, `recommendation`, dan `status` tidak tersentuh: #16 tetap `WEAK_FIT` / 36.00,
#17 `WEAK_FIT` / 21.60. Skor itu berasal dari penilaian AI, bukan dari anomali `PDF_MICRO_IMAGE`.

Rollback bila diperlukan: `INSERT INTO candidate_anomalies SELECT * FROM
candidate_anomalies_bak_20261021;` — nilai `triage_priority` yang sudah di-reset tidak ikut
kembali, karena `UPDATE` no-op maka tidak ada yang perlu dipulihkan.

---

## 6. Evidence Graph — Sinkron dengan CV & Anomali yang Menjelaskan Diri

> **Status bagian ini: SELESAI (21 Oktober 2026).** Ditemukan dari keluhan pemakaian, bukan
> dari test: graf bukti tidak memuat teknologi yang tertulis jelas di CV, dan kartu anomali
> hanya menampilkan kode teknis tanpa penjelasan.

### 6.1 Graf hanya memuat requirement lowongan, bukan isi CV

**Berkas:** `backend/app/core/scoring.py:171`, `:214`

Loop pembuatan evidence berjalan atas `core_competencies` (kebutuhan lowongan), bukan atas
klaim CV. Akibatnya CV yang menyebut Next.js, Prisma, Tailwind, NextAuth, Supabase, dan React
hanya menampilkan node untuk requirement backend — enam teknologi hilang dari graf meskipun
terbaca jelas oleh parser. Jumlah node maksimum selalu sama dengan jumlah requirement lowongan,
sehingga graf terbaca sebagai "apa yang diminta job", bukan "apa isi CV".

**Perbaikan:** evidence dibuat per **teknologi CV**. Teknologi yang tidak diminta lowongan tetap
menjadi baris dengan skor 0 dan `matched_requirement = NULL`; UI menandainya "Tidak diminta
lowongan". Teknologi yang cocok diberi label "Memenuhi syarat: X".

### 6.2 Anomali hanya berupa kode, tanpa konteks

**Berkas:** `backend/app/core/triage_service.py:297`, `:304`; `backend/app/core/scoring.py:354`

Isi `description` satu-satunya adalah `f"Automated risk detection flag: {flag}"`, dan
`suggested_verification` di-hardcode `"Review during HR interview."`. Flag-nya sendiri hanya
berupa `CONCURRENT_FULLTIME_OVERLAP_{n}_MONTHS` — tanpa peran, perusahaan, atau periode. HR
menerima kode yang tidak bisa ditindaklanjuti.

**Perbaikan:** `evaluate_risk` mengembalikan tiga nilai `(risk, flags, details)`; `details`
memuat deskripsi manusia, periode overlap, kedua peran dan perusahaan, serta
`suggested_verification` yang spesifik. `anomaly_details` disimpan ke
`candidate_anomalies`. Contoh keluaran sekarang: *"Dua pekerjaan penuh waktu berjalan bersamaan
selama 24 bulan (2024-01 s/d 2025-12): 'Guru KMI' di Pondok Modern Tazakka tumpang tindih dengan
'Staff Media' di Media Center Pondok Modern Tazakka."*

### 6.3 Kutipan parafrase tampil sebagai kutipan verbatim

**Berkas:** `backend/app/schemas/extraction.py:95`

Substring guard hanya menurunkan `has_implementation_detail` saat narasi tidak ditemukan di teks
CV; `context_narrative` tetap tersimpan. UI lalu menampilkan parafrase LLM dengan label "Kutipan
Asli CV". Itu klaim integritas yang tidak benar.

**Perbaikan:** guard men-null-kan `context_narrative` dan `metric_string` saat gagal. Lebih baik
kosong daripada menampilkan teks yang tidak ada di CV. Di UI, label "Kutipan Asli CV" hanya
muncul bila `verified`; selain itu "Sebutan di CV" atau "Belum terverifikasi".

### 6.4 Cacat susulan dari laporan operator VPS

Setelah deploy, operator melaporkan hasil triage ulang. Tiga cacat ditemukan, dua di antaranya
kesalahan penulis sendiri:

| # | Cacat | Sebab | Perbaikan |
|---|---|---|---|
| 1 | Overlap dilaporkan 23 bulan untuk periode 2024-01 s/d 2025-12 | `evaluate_risk` memakai selisih eksklusif sementara `merge_employment_intervals` memakai `end - start + 1` — dua konvensi di satu berkas | Keduanya inklusif; periode itu = 24 bulan. Ambang klasifikasi tidak berubah |
| 2 | Lima kandidat jatuh ke heuristic fallback | `Literal` ketat pada output LLM; satu label meleset menggagalkan seluruh `CandidateExtractionSchema` | `_match_enum()` di ketiga field enum (§6.5) |
| 3 | Node teknologi dobel (PostgreSQL dua kali) | Dedupe mengelompokkan per pasangan (teknologi, requirement) | Satu node per nama teknologi; requirement digabung ke `matched_requirement` |

**Kesalahan penulis yang perlu dicatat.** Tes overlap awalnya menegaskan 16 bulan, gagal (kode
memberi 15), lalu **tesnya** yang diubah menjadi 15 — memaksa tes setuju dengan kode yang salah.
Assertion sudah dikembalikan ke 16. Tes harus menjadi pengukur, bukan yang disesuaikan.

### 6.5 `Literal` ketat pada output LLM — akar masalah, bukan gejala

Bug yang sama muncul **tiga kali berturut-turut**, masing-masing di kandidat berbeda, dan
gejalanya bergeser setiap kali satu field ditambal:

1. `employment_type = 'career_break'` → kandidat ID 5
2. `company = null` pada baris jeda karier → kandidat ID 5 (setelah tambalan pertama)
3. `graduation_status = 'Sedang Menempuh Pendidikan'` → kandidat ID 8

Tambalan per field akan terus memunculkan field berikutnya. **Perbaikan:** `_match_enum()` —
cocok persis, lalu tabel alias, lalu pencocokan substring (alias terpanjang lebih dulu, agar
"belum lulus" tidak terbaca "lulus"), terakhir nilai fallback. Tidak pernah melempar error
validasi. Dipasang di `ClaimItem.dimension`, `CareerTimelineItem.employment_type`, dan
`EducationItem.graduation_status`, plus toleransi `null` pada `technology`, `degree`,
`field_of_study`, `role`, `company`, `start`, `end`.

**Pelajaran untuk kode berikutnya:** jangan pasang `Literal` ketat pada field yang diisi model
bahasa. Pakai validator dengan alias sejak awal.

### 6.6 Batas yang masih berlaku

- **Label rekomendasi masih template.** `aiExplanation` di frontend menyusun narasi dari
  `switch` pada `recommendation`, bukan dari keluaran model. Labelnya sudah diubah menjadi
  "Template Kategori Rekomendasi" dengan badge `TEMPLATE`, dan memakai `rationale` backend bila
  tersedia. Untuk narasi per kandidat yang benar-benar dari AI, backend perlu mengembalikan
  field rationale dari triage.
- **Anomali tetap perlu triage ulang.** Teks anomali disimpan saat triage, bukan dihitung saat
  halaman dibuka. Perbaikan kode tidak mengubah baris lama — semua kandidat sudah di-triage
  ulang 21 Oktober 2026, tetapi kandidat baru yang masuk sebelum deploy akan memakai format lama.
- **Ambang overlap >3 bulan** berasal dari PRD, belum divalidasi terhadap data karier nyata.

---

## 7. Pengerasan Keamanan VPS (21 Oktober 2026)

Ditemukan dari laporan operator saat menjalankan migrasi, bukan dari audit terjadwal.

### 7.1 Password database tercetak di log — SELESAI

`backend/scripts/init_db.py:21` mencetak `settings.SYNC_DATABASE_URL` utuh, sehingga password
user MariaDB muncul di stdout, riwayat shell, dan `journalctl` setiap kali migrasi dijalankan.
Nilai itu ikut tersalin ke laporan eksekusi dan ke log internal agent CLI di
`/home/willynaren/.gemini/antigravity-cli/brain/steps/`.

**Perbaikan:** `_mask_dsn()` mengganti bagian password menjadi `***` sebelum dicetak; DSN asli
tetap dipakai untuk `create_engine`.

**Rotasi:** password `talentops_app` dan `willy` sudah diganti, password lama ditolak
(`ERROR 1045`). Password `willy` (32 karakter acak) disimpan di
`/root/.talentops-willy-db-pass` mode `0600`. Journal dibersihkan (`--vacuum-time=1s`, 173,8 MB)
dan file log yang memuat DSN dihapus.

### 7.2 Port 3306 terbuka ke publik — SELESAI

`/etc/mysql/mariadb.conf.d/50-server.cnf:27` berisi `bind-address = 0.0.0.0` dan UFW
`inactive`, sehingga MariaDB dapat dijangkau dari internet. Ditemukan bersamaan dengan
pemeriksaan sebelum rotasi password.

**Perbaikan:** `bind-address = 127.0.0.1`, MariaDB di-restart. Verifikasi: hanya
`127.0.0.1:3306` yang listen. Backup konfigurasi di `/root/50-server.cnf.bak.2026-10-21_0528`.
Pre-check sebelum perubahan: seluruh koneksi `established` berasal dari `127.0.0.1` dan tidak ada
sesi eksternal, sehingga tidak ada klien yang terputus.

### 7.3 Yang masih terbuka

- **`willy@%` tetap ada** dengan `GRANT ALL PRIVILEGES ON *.* WITH GRANT OPTION`. Host wildcard
  kini tidak berbahaya dari luar (port tertutup), tetapi akun ini setara root DB dan dapat
  memberi izin ke akun lain. **Diputuskan dibiarkan** oleh pemilik sistem. Bila berubah pikiran:
  `DROP USER 'willy'@'%'` (tidak ada cron, systemd unit, atau sesi yang memakainya) atau batasi
  ke `'willy'@'localhost'`.
- **UFW masih `inactive`.** Jangan diaktifkan tanpa `ufw allow 22/tcp` lebih dulu — urutan yang
  salah akan memutus SSH dan mengunci akses ke VPS. Sebaiknya lewat console penyedia, bukan SSH.
- **Agent CLI merekam rahasia ke disk.** Setiap perintah yang mencetak secret tersimpan di
  `~/.gemini/antigravity-cli/brain/steps/*/output.txt`. Jangan jalankan perintah berisi password
  lewat agent; pakai `MYSQL_PWD` atau `--defaults-extra-file`.
- **`mysql_native_password`** masih dipakai `willy`. Hash SHA1, sudah deprecated. Bila akun itu
  dipertahankan, pertimbangkan `caching_sha2_password`.

---

## 8. Revisi Kelima — Fitur yang Sebelumnya Tidak Ada di Daftar (21 Oktober 2026)

Tiga pekerjaan berikut tidak pernah masuk daftar prioritas mana pun, padahal ketiganya murni
kode dan tidak menunggu masukan luar. Semuanya selesai.

### 8.1 What-If Simulation Studio — endpoint ada, UI tidak

`POST /api/jobs/{id}/simulate-policy` (`jobs.py:231`) sudah lengkap sejak awal beserta test-nya,
tetapi **tidak ada satu pun pemanggil di frontend**. Route `/admin/what-if` hanya
`<Navigate to="/admin/jobs" />`, sehingga fitur yang menjadi baris pembeda di matriks PRD §4.2
("Simulasi Kebijakan: Tidak tersedia" pada ketiga kompetitor) tidak bisa ditunjukkan saat demo.

Yang dipasang:

- `WhatIfStudio.jsx` — slider bobot 4D + slider passing grade, re-run otomatis debounce 350 ms,
  kartu pergeseran distribusi, tabel baseline vs simulasi per kandidat (`delta_score`,
  `rule_applied`, badge karantina).
- `DashboardOverview.jsx` — kartu per lowongan sebagai pintu masuk studio. Mapping kandidat
  sebelumnya membuang `job_id` yang sudah dikirim backend; field itu dipulihkan lalu pool
  dikelompokkan per lowongan, digabung dengan bobot tersimpan dari `GET /api/jobs`.
- `App.jsx` — route `what-if/:jobId` (lazy load).

Dua keputusan yang perlu diketahui pembaca dokumen ini:

- Slider passing grade mulai di **85**, bukan 75 (default endpoint). Baseline `overall_score`
  tersimpan dihitung dengan ambang 85, jadi memulai di 75 akan mencampur efek perubahan bobot
  dengan efek pelonggaran ambang pada simulasi pertama.
- Fetch kandidat dashboard naik dari `limit=50` ke `limit=200`. Angka pada kartu dihitung dari
  jendela list, sedangkan server tetap mengevaluasi seluruh pool saat simulasi.

### 8.2 Pembersih slot `tentative` berjalan karena request, bukan karena waktu

`release_expired_tentative_slots()` (`adapters/calendar.py:147`) logikanya benar, tetapi
satu-satunya pemanggil ada di dalam handler `GET /api/slots/available` (`slots.py:36`). Akibat
yang sebenarnya terjadi: slot yang TTL-nya sudah lewat tetap berstatus `tentative` dan tampak
terpakai bagi kandidat lain, sampai ada orang yang kebetulan membuka daftar slot. Pemicunya lalu
lintas request, bukan waktu.

`app/core/maintenance.py` menambahkan loop periodik lewat `lifespan` di `main.py`: slot cleaner
tiap 300 detik (PRD Bab 6.3 minta 5 menit). Runner membungkus tiap tick dengan `try/except`
supaya satu kegagalan tidak mematikan loop, sementara `CancelledError` tetap diteruskan agar
shutdown bersih.

**Pembersih data demo 4 jam (PRD baris 388) tidak diaktifkan.** Tidak ada kolom yang membedakan
unggahan demo dari dataset golden, sehingga `DELETE FROM candidates WHERE created_at < cutoff`
akan menghapus **seluruh** kandidat termasuk data penjurian. Job-nya ada di balik
`DEMO_PURGE_ENABLED` (default `False`), terpisah dari `DEMO_MODE` justru karena alasan itu.
Jangan dinyalakan di DB yang memuat dataset lomba.

### 8.3 Klaim append-only tidak pernah ditegakkan database

`audit.py:132` mencetak `"Append-Only Immutable Audit Trail (REVOKE UPDATE, DELETE)"` ke setiap
konsumen endpoint audit. Kenyataannya: tidak ada migrasi mana pun yang menjalankan `REVOKE`
(migrasi berhenti di `003`), dan `willy@%` masih memegang `GRANT ALL ON *.* WITH GRANT OPTION`
(§7.3), sehingga pagar hak akses bisa dibuka kembali.

Yang benar-benar berlaku: tidak ada satu pun jalur kode aplikasi yang melakukan `UPDATE`/`DELETE`
pada `agent_steps`, `pii_access_logs`, atau `human_reviews` — sudah diverifikasi pada seluruh
`backend/app/`. Jadi sifat append-only ditegakkan oleh **konvensi kode**, bukan database engine.

Teks klaim sudah dikoreksi menjadi pernyataan jujur, dan PRD §6.1 butir 6 diberi catatan status
implementasi. **Penegakan fisik ditunda atas keputusan pemilik.** Bila nanti dikerjakan, trigger
`BEFORE UPDATE`/`BEFORE DELETE` dengan `SIGNAL SQLSTATE '45000'` lebih kuat daripada `REVOKE`
karena tetap berlaku bagi user dengan hak penuh.

### 8.4 Banner data sintetis

PRD §6.2 mewajibkan peringatan _"Gunakan data sintetis"_ di antarmuka demo; sebelumnya nol hasil
pencarian `sintetis`/`synthetic` di `frontend/src`. Sekarang `DemoDataBanner.jsx` tampil di atas
`Header` pada seluruh halaman `/admin/*`, dikendalikan `VITE_DEMO_BANNER` (default tampil).

### 8.5 Yang masih terbuka dari revisi ini

- **Dark mode** belum ada dan tidak dikerjakan. `tailwind.config.js` tidak punya `darkMode`, dan
  `App.jsx:195` justru menghapus class `dark` serta `localStorage` theme setiap kali halaman
  dimuat — ada kode yang sengaja mematikannya. PRD hari 6–8 masih menyebut dark mode; klaim itu
  perlu dihapus dari PRD atau fiturnya dibangun. **Belum diputuskan.**
- **PRD §2 menjual lebih rendah dari kenyataan:** baris 58 dan 60 masih menulis Calendar Adapter
  dan Candidate Dispatcher sebagai `[MVP]` mock, padahal yang terpasang OAuth2 Google Calendar
  dan Resend asli. Perlu dinaikkan ke `[TARGET]` agar proposal tidak merendahkan diri sendiri.
  **Belum diperbaiki.**
- **Banner hanya di shell `/admin/*`.** Career Portal publik belum memasangnya karena ticker
  `fixed top-0` di sana akan bertabrakan; menempatkannya butuh penggeseran layout portal.
  **Belum dikerjakan.**

---

## Urutan Pengerjaan yang Disarankan

| Prioritas | Pekerjaan | Alasan | Status |
|---|---|---|---|
| 1 | Tutup `GET /api/candidates/stream/{id}` dan pindahkan frontend ke alur tiket | Satu fungsi, dampak keamanan tertinggi | **Selesai** + verified live |
| 2 | Ukur recall sanitizer pada 25 CV golden dataset | Bahan sudah ada; mengubah klaim menjadi bukti | **Selesai** — 100% (90/90) |
| 3 | Login UI + `DEMO_MODE=False` | Membuka kunci RBAC item 1; keduanya harus bersamaan | **Selesai** + verified live |
| 4 | Isi kredensial VPS, verifikasi live Calendar & Resend | Mengubah stub menjadi integrasi sungguhan | Belum — butuh akun Google Cloud + Resend |
| 5 | Pasang Redis di VPS, jalankan >1 worker | Membuktikan klaim multi-worker | **Dibatalkan** — pemilik sistem menolak Redis (beban server); tetap 1 worker |
| 6 | Simpan identitas asli pada jalur dropzone | Melengkapi item 5 agar identitas bisa dibuka secara sah | Belum — butuh keputusan produk |
| 7 | Sambungkan UI kalender, notifikasi, badge residual risk | Membuat fitur backend terlihat | **Selesai** — `0647247`, `dbc41ed`, `a2909ca` |
| 8 | Bersihkan baris `PDF_MICRO_IMAGE` lama + reset `triage_priority` palsu | Perbaikan kode tidak menyentuh data yang sudah masuk | **Selesai** 21 Okt 2026 — 398 baris dihapus, §5.1 |
| 9 | Sinkronkan Evidence Graph dengan isi CV + anomali berbahasa manusia | Graf terbaca HR sebagai isi CV, bukan daftar requirement | **Selesai** — `22d7292`, `f39af8a`, `50d2e5f`, §6 |
| 10 | Tutup `bind-address` 3306 + rotasi password DB | Port DB terbuka ke internet dengan UFW mati | **Selesai** — `127.0.0.1`, kedua password dirotasi, §7 |
| 11 | Hilangkan `Literal` ketat pada output LLM | Satu label meleset = seluruh ekstraksi gagal; sudah terulang 3× | **Selesai** — `_match_enum()`, §6.5 |
| 12 | Bangun UI What-If Simulation Studio | Endpoint sudah ada tanpa pemanggil; baris pembeda di matriks PRD §4.2 | **Selesai** — `c9940d7`, §8.1 |
| 13 | Jalankan pembersih slot `tentative` secara periodik | Slot kedaluwarsa menggantung sampai ada request lain yang membuka daftar slot | **Selesai** — `bbe246f`, §8.2 |
| 14 | Koreksi klaim append-only yang tidak ditegakkan DB | Sistem memberi tahu auditor ada kontrol yang tidak ada | **Selesai** — `bbe246f`, §8.3. Penegakan fisik ditunda |
| 15 | Banner "Gunakan data sintetis" di UI demo | Kewajiban PRD §6.2; belum ada sama sekali | **Selesai** — `f82d002`, §8.4 |
| 16 | Dark mode dashboard | Disebut PRD hari 6–8; `tailwind.config.js` tanpa `darkMode`, `App.jsx` sengaja mematikan | Belum — butuh keputusan: bangun atau hapus klaim |
| 17 | Naikkan status Calendar & Dispatcher di PRD §2 ke `[TARGET]` | Yang terpasang OAuth2 Google Calendar + Resend asli, bukan mock | Belum — dokumen saja |

Catatan: prioritas 4 dan 6 butuh masukan dari luar repositori. Prioritas 4 butuh akun Google
Cloud + Resend (dan domain pengirim terverifikasi). Prioritas 6 butuh keputusan produk lebih
dulu: dari mana identitas asli diperoleh pada jalur dropzone — kolom form tambahan saat unggah,
atau ekstraksi header dengan konfirmasi HR — karena sanitizer sengaja tidak menyimpan nilai yang
ia redaksi. Prioritas 8 hanya butuh akses ke MariaDB produksi.

Sisa daftar ini tinggal empat butir, dan **tidak satu pun menunggu pekerjaan kode yang belum
diputuskan**: prioritas 4 menunggu kredensial eksternal, prioritas 6 menunggu keputusan produk,
prioritas 16 menunggu keputusan (bangun dark mode atau hapus klaimnya dari PRD), dan prioritas 17
hanya butuh penyuntingan dokumen. Kalimat "tidak ada lagi pekerjaan murni kode" dari revisi
ketiga sudah tidak berlaku — revisi kelima justru menemukan tiga pekerjaan murni kode yang belum
tercatat (prioritas 12–15) dan menyelesaikannya.

---

## Yang Sudah Selesai (Rujukan)

| Item | Commit | Status |
|---|---|---|
| 1. Auth & RBAC | `7f62479` | **Aktif & terverifikasi live** — `DEMO_MODE=False`, login UI ada, endpoint SSE bertiket |
| 2. Redis multi-worker | `0fc24d0` | **Dibatalkan** — tanpa Redis, 1 worker (kode fallback dipertahankan) |
| 3. PDF hidden-text | `d5649e0`, `550998e` | Siap produksi (batas: tanpa OCR). `550998e` memperbaiki false positive `PDF_MICRO_IMAGE` (§3.5) |
| 4. Integrasi eksternal | `7314d98`, `b4f2b2d` | Kode selesai; **belum pernah live** |
| 5. Sanitasi PII | `eba88bc` | Siap produksi (batas: tanpa NER); recall terukur 100% pada 25 CV riil |
| 6. Evidence Graph | `22d7292`, `f39af8a`, `50d2e5f` | **Aktif & terverifikasi live** — evidence per teknologi CV, anomali berbahasa manusia, kolom `matched_requirement`/`verified` (§6) |
| 7. Pengerasan VPS | `211cc0f` | **Aktif** — password DB tidak lagi tercetak; `bind-address` 3306 ditutup, kedua password dirotasi (§7) |
| 8. What-If Studio UI | `c9940d7` | **Aktif** — kartu per lowongan di dashboard + studio berperute `what-if/:jobId` (§8.1) |
| 9. Pembersih slot periodik | `bbe246f` | **Aktif setelah deploy** — `maintenance.py` lewat `lifespan`, interval 300 s (§8.2) |
| 10. Klaim append-only dikoreksi | `bbe246f` | **Aktif** — teks API jujur; penegakan DB ditunda (§8.3) |
| 11. Banner data sintetis | `f82d002` | **Aktif** — `DemoDataBanner.jsx` di shell `/admin/*` (§8.4) |

Commit sesi ini (21 Oktober 2026):

| Commit | Isi |
|---|---|
| `b0557e0` | Guard tiket pada endpoint SSE lama + `stream_url` bertiket |
| `adeef02` | `DEMO_MODE=False` + perbaikan `auth.py` (baris parsial menimpa klaim token) |
| `9563d76` | Login gate frontend + alur tiket di `AgentTraceModal` |
| `08da3e7` | Ukur recall sanitizer pada 25 CV + update dokumen ini |
| `0964283` | Hapus dua laporan evaluasi sprint 4 yang basi |
| `8ac6122` | Seed menulis ulang `password_hash`; dukungan `SEED_ADMIN_PASSWORD` |
| `a8e7199` | Hapus origin `talentops.vercel.app` (aplikasi lain) dari CORS |
| `cb8cde6` | Pindah domain frontend ke `talentops.ai.id` + perbaiki regex CORS |

Commit revisi kedua (sesi yang sama, branch `feat/ui-backend-feature-surfacing` dan
`feat/backend-pdf-micro-image-dedup`):

| Commit | Isi |
|---|---|
| `a2909ca` | Tampilkan laporan sanitasi PII pada upload dropzone |
| `dbc41ed` | Tampilkan status Calendar & Email setelah keputusan review |
| `0647247` | Panel Google Calendar `/admin/calendar` + rute + menu sidebar |
| `f6b983a` | Worklog Willy 2026-10-21 |
| `550998e` | Dedup `PDF_MICRO_IMAGE` per objek + agregasi anomali + eskalasi hanya untuk `HIGH` |
| `bef5f7c` | Batasi badge anomali di tabel kandidat, sembunyikan sebelum scan |
| `007a902`, `69c904a` | Merge `--no-ff` kedua branch ke `main` |

Pembersihan data produksi (bukan commit, dijalankan langsung di MariaDB):

| Operasi | Hasil |
|---|---|
| Backup ke `candidate_anomalies_bak_20261021` | 398 baris |
| `DELETE ... WHERE anomaly_type = 'PDF_MICRO_IMAGE'` | 398 baris, 0 tersisa |
| `UPDATE candidates SET triage_priority = 'STANDARD'` (jaring pengaman) | 0 baris — no-op |

Catatan: commit `b4f2b2d` (konfirmasi erasure pada withdraw) dan `eba88bc` (sanitasi PII)
juga menutup dua kekurangan yang sebelumnya tidak tercatat — template `erasure_confirmation`
yang tidak pernah dipakai, dan jalur dropzone yang masih hanya mengaudit DOCX sehingga PDF
tidak diperiksa teks tersembunyinya.

Commit revisi keempat (branch `feat/ai-evidence-traceability`, `fix/ai-overlap-months-and-schema-resilience`,
`fix/ai-null-company-and-tech-dedupe`, `fix/ai-enum-normalization`):

| Commit | Isi |
|---|---|
| `22d7292` | Evidence per teknologi CV, `months_to_label`, `evaluate_risk` → 3-tuple, substring guard men-null-kan narasi |
| `f39af8a` | Migrasi `003_evidence_verification.sql`, persist `matched_requirement`/`verified`/`anomaly_details`, hapus anomali lama sebelum re-triage |
| `50d2e5f` | `EvidenceGraph` lane anomali terpisah, label verified/unverified, confidence dari severity |
| `7d33e60` | Hitungan bulan overlap inklusif; `employment_type` asing tidak menjatuhkan ekstraksi |
| `211cc0f` | `_mask_dsn()` — password DB tidak lagi tercetak |
| `a3dd009` | Terima `company: null`; satu node per nama teknologi |
| `8fa3778` | `_match_enum()` di ketiga field enum — akar masalah `Literal` ketat |
| `fe339da`, `8bbc7e6`, `c2da6cd`, `2b04e75` | Merge `--no-ff` ke `main` |

Triage ulang produksi (bukan commit, dijalankan lewat API):

| Operasi | Hasil |
|---|---|
| Triage ulang seluruh kandidat (2 putaran) | 17 kandidat, 0 gagal |
| Heuristic fallback tersisa | **0** (sebelumnya 5: ID 5, 8, 10, 13, 14) |
| Node teknologi duplikat | 0 di seluruh kandidat |
| Anomali `#TK-2FD8DC` | 24 bulan (sebelumnya 23), menyebut kedua peran + perusahaan |
