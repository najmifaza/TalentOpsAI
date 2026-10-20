# Status Pekerjaan Backend — Apa yang Belum Selesai

**Terakhir diperbarui:** 20 Oktober 2026
**Branch acuan:** `main` @ `eba88bc`
**Status pengujian:** `uv run pytest backend/tests -q` → **178 passed, 0 failed**

Dokumen ini mendaftar pekerjaan yang **belum** selesai setelah lima item penguatan backend
(auth/RBAC, Redis multi-worker, PDF hidden-text, integrasi eksternal, sanitasi PII).

Ringkasan singkat: kelima item selesai di tingkat kode dan lulus seluruh test otomatis,
tetapi baru **item 3 dan item 5** yang layak disebut siap produksi. Item 1 setengah aktif,
item 2 belum pernah berjalan di Redis nyata, dan item 4 belum pernah menyentuh penyedia
eksternal sama sekali.

---

## 1. Lubang Keamanan — Harus Ditutup Sebelum Apa Pun

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

---

### 1.3 Frontend belum memiliki autentikasi apa pun

**Cakupan:** 15 komponen di `frontend/src/`

- Pencarian `Authorization` → **0 hasil**
- Pencarian `auth/login` atau `/api/auth` → **0 hasil**
- Tidak ada halaman login, tidak ada penyimpanan token, tidak ada refresh

Artinya, meskipun `DEMO_MODE=False` dinyalakan, UI akan langsung gagal karena tidak ada cara
memperoleh token. Item 1 dan item 1.3 saling mengunci: keduanya harus dikerjakan bersamaan.

Backend sudah menyediakan `POST /api/auth/login` dan `GET /api/auth/me`.

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

### 3.3 Recall sanitizer belum diukur pada golden dataset yang sudah tersedia

**Koreksi terhadap klaim sebelumnya:** `backend/data/golden_dataset/` **sudah berisi 25 CV**
lengkap (`cv_01_budi_santoso` … `cv_25_wahyu_hidayat`, masing-masing `.txt` + `.docx`) plus
`pre_cached_fixtures.json`.

Dan `backend/tests/test_benchmark_sprint4.py:16` sudah menguji recall terhadap entitas PII
sintetis yang disuntikkan ke narasi proyek — hasil ukur: **100% (42/42 entitas, latensi
0,277 ms)**, lulus dengan ambang ≥ 98%.

> Catatan kecil: docstring test tersebut menyebut "50 synthetic PII entities", padahal
> jumlah sebenarnya **42 entitas** dari 10 potongan narasi. Angka pada dokumen ini memakai
> hasil hitung `sum(item[4])`, bukan klaim docstring.

**Yang belum:** tidak ada satu pun test yang menjalankan sanitizer terhadap 25 CV tersebut.
Angka 98% valid untuk entitas sintetis, tetapi belum ada bukti pada dataset riil yang sudah
ada di repositori. Ini pekerjaan yang bisa diselesaikan sekarang tanpa bahan baru.

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

| Prioritas | Pekerjaan | Alasan |
|---|---|---|
| 1 | Tutup `GET /api/candidates/stream/{id}` dan pindahkan frontend ke alur tiket | Satu fungsi, dampak keamanan tertinggi |
| 2 | Ukur recall sanitizer pada 25 CV golden dataset | Bahan sudah ada; mengubah klaim menjadi bukti |
| 3 | Login UI + `DEMO_MODE=False` | Membuka kunci RBAC item 1; keduanya harus bersamaan |
| 4 | Isi kredensial VPS, verifikasi live Calendar & Resend | Mengubah stub menjadi integrasi sungguhan |
| 5 | Pasang Redis di VPS, jalankan >1 worker | Membuktikan klaim multi-worker |
| 6 | Simpan identitas asli pada jalur dropzone | Melengkapi item 5 agar identitas bisa dibuka secara sah |
| 7 | Sambungkan UI kalender, notifikasi, badge residual risk | Membuat fitur backend terlihat |

---

## Yang Sudah Selesai (Rujukan)

| Item | Commit | Status |
|---|---|---|
| 1. Auth & RBAC | `7f62479` | Kode selesai; **belum aktif** karena `DEMO_MODE` dan tidak ada login UI |
| 2. Redis multi-worker | `0fc24d0` | Kode selesai; **belum diuji** di Redis nyata |
| 3. PDF hidden-text | `d5649e0` | Siap produksi (batas: tanpa OCR) |
| 4. Integrasi eksternal | `7314d98`, `b4f2b2d` | Kode selesai; **belum pernah live** |
| 5. Sanitasi PII | `eba88bc` | Siap produksi (batas: tanpa NER) |

Catatan: commit `b4f2b2d` (konfirmasi erasure pada withdraw) dan `eba88bc` (sanitasi PII)
juga menutup dua kekurangan yang sebelumnya tidak tercatat — template `erasure_confirmation`
yang tidak pernah dipakai, dan jalur dropzone yang masih hanya mengaudit DOCX sehingga PDF
tidak diperiksa teks tersembunyinya.
