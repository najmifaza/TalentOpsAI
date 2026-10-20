# Status Pekerjaan Backend — Apa yang Belum Selesai

**Terakhir diperbarui:** 21 Oktober 2026
**Branch acuan:** `main` (di atas `eba88bc`, perubahan belum di-commit)
**Status pengujian:** `uv run pytest backend/tests -q` → **193 passed, 0 failed**

Dokumen ini mendaftar pekerjaan yang **belum** selesai setelah lima item penguatan backend
(auth/RBAC, Redis multi-worker, PDF hidden-text, integrasi eksternal, sanitasi PII).

Ringkasan singkat: kelima item selesai di tingkat kode dan lulus seluruh test otomatis.
Item 3 dan item 5 siap produksi. **Item 1 kini benar-benar aktif** (tiga lubang di §1 sudah
ditutup). Item 2 belum pernah berjalan di Redis nyata, dan item 4 belum pernah menyentuh
penyedia eksternal sama sekali.

**Perubahan sesi ini:** §1.1, §1.2, §1.3, dan §3.3 sudah selesai — lihat penanda
**SUDAH SELESAI** pada masing-masing bagian.

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
| Redis multi-worker | 10 test dengan `fakeredis` | `REDIS_URL` kosong; `redis-server` dan `docker` tidak terpasang di host |
| MariaDB | SQL divalidasi ke SQLite in-memory | Tidak ada instance MariaDB; dialek belum diuji ke server sungguhan |

**Catatan Redis:** jalur multi-worker adalah alasan utama item 2 dikerjakan, tetapi belum
pernah dieksekusi dengan lebih dari satu worker. Klaim "aman multi-worker" saat ini bersandar
pada kesesuaian logika, bukan pada pengamatan.

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

---

## 4. Frontend Belum Menyambut Fitur Baru

Pencarian di `frontend/src`:

| Fitur backend | Hasil pencarian | Dampak |
|---|---|---|
| `calendar` | 0 hasil | Endpoint `status`/`oauth/authorize`/`disconnect` ada, UI-nya tidak ada |
| `notifications` | 0 hasil | Field baru pada respons review tidak dibaca |
| `residual_risk` | 0 hasil | Badge peringatan PII belum dibuat |
| `sanitization` | 2 hasil | Hanya `sanitization_stats` lama; blok `sanitization`/`pii_sanitization` baru belum dipakai |

Fitur backend yang tidak terlihat di UI secara praktis tidak ada bagi pengguna.

---

## 5. Operasional & Deployment

- `nginx/talentops.conf` dan `frontend/vercel.json` sudah ada (rewrite `/api/(.*)` →
  `https://api-talentops.fawt.biz.id/api/$1`), tetapi **tidak ada bukti** kode baru sudah
  ter-deploy ke VPS maupun Vercel.
- VPS belum dikonfirmasi memiliki Redis; tanpa itu, `REDIS_URL` tetap kosong dan sistem
  berjalan single-worker.
- Variabel lingkungan baru pada `backend/.env.example` (`GOOGLE_*`, `RESEND_*`, `EMAIL_*`,
  `REDIS_*`, `OAUTH_SUCCESS_REDIRECT`) belum diisi di `.env` mana pun.

---

## Urutan Pengerjaan yang Disarankan

| Prioritas | Pekerjaan | Alasan | Status |
|---|---|---|---|
| 1 | Tutup `GET /api/candidates/stream/{id}` dan pindahkan frontend ke alur tiket | Satu fungsi, dampak keamanan tertinggi | **Selesai** |
| 2 | Ukur recall sanitizer pada 25 CV golden dataset | Bahan sudah ada; mengubah klaim menjadi bukti | **Selesai** — 100% (90/90) |
| 3 | Login UI + `DEMO_MODE=False` | Membuka kunci RBAC item 1; keduanya harus bersamaan | **Selesai** |
| 4 | Isi kredensial VPS, verifikasi live Calendar & Resend | Mengubah stub menjadi integrasi sungguhan | Belum |
| 5 | Pasang Redis di VPS, jalankan >1 worker | Membuktikan klaim multi-worker | Belum |
| 6 | Simpan identitas asli pada jalur dropzone | Melengkapi item 5 agar identitas bisa dibuka secara sah | Belum |
| 7 | Sambungkan UI kalender, notifikasi, badge residual risk | Membuat fitur backend terlihat | Belum |

Catatan untuk prioritas 4–7: keempatnya butuh akses di luar repositori (kredensial penyedia,
VPS, atau keputusan produk soal identitas pelamar), jadi tidak bisa diselesaikan hanya dari
kode. Prioritas 6 punya satu keputusan yang harus diambil lebih dulu: dari mana identitas asli
diperoleh pada jalur dropzone — kolom form tambahan saat unggah, atau ekstraksi header dengan
konfirmasi HR — karena sanitizer sengaja tidak menyimpan nilai yang ia redaksi.

---

## Yang Sudah Selesai (Rujukan)

| Item | Commit | Status |
|---|---|---|
| 1. Auth & RBAC | `7f62479` | **Aktif** — `DEMO_MODE=False`, login UI ada, endpoint SSE bertiket |
| 2. Redis multi-worker | `0fc24d0` | Kode selesai; **belum diuji** di Redis nyata |
| 3. PDF hidden-text | `d5649e0` | Siap produksi (batas: tanpa OCR) |
| 4. Integrasi eksternal | `7314d98`, `b4f2b2d` | Kode selesai; **belum pernah live** |
| 5. Sanitasi PII | `eba88bc` | Siap produksi (batas: tanpa NER) |

Catatan: commit `b4f2b2d` (konfirmasi erasure pada withdraw) dan `eba88bc` (sanitasi PII)
juga menutup dua kekurangan yang sebelumnya tidak tercatat — template `erasure_confirmation`
yang tidak pernah dipakai, dan jalur dropzone yang masih hanya mengaudit DOCX sehingga PDF
tidak diperiksa teks tersembunyinya.
