# TalentOps AI

Agen rekrutmen otonom berbasis bukti. Agen membaca berkas pelamar, menyaring data
pribadi lebih dulu, menghitung skor dengan aritmetika deterministik, dan berhenti di
gerbang persetujuan manusia sebelum ada keputusan yang dikirim.

Dibuat untuk **GTNIC 2026 (AI Agent Development)** dan **UINIC 8.0 (Web Development)**.

- Demo web: https://talentops.ai.id
- Demo API: https://api.talentops.ai.id
- PRD: [`docs/PRD_TALENTOPS_AI_MASTER.md`](docs/PRD_TALENTOPS_AI_MASTER.md)
- Catatan pekerjaan yang belum selesai: [`docs/STATUS_PEKERJAAN_BELUM_SELESAI.md`](docs/STATUS_PEKERJAAN_BELUM_SELESAI.md)

## Delapan tahap agen

Setiap kandidat melewati delapan tahap berurutan, semuanya tercatat di tabel
`agent_steps` (masukan, luaran, durasi) dan dialirkan ke UI lewat SSE:

1. Sensor privasi data pribadi: ekstrak teks PDF, pindai teks tersembunyi, kaburkan
   nama/email/telepon menjadi identitas anonim `#TK-[6-HEX]`
2. Uji integritas berkas: render mode 3, teks nyaris putih, glyph maksimal 1pt pada
   PDF, serta `w:vanish` / `w:hidden` pada DOCX
3. Analisis riwayat dan kompetensi: ekstraksi klaim lewat gateway LLM dengan skema
   Pydantic ketat
4. Pencocokan bukti kalimat asli: klaim tanpa kutipan pendukung ditandai belum
   terverifikasi dan menurunkan tingkat keyakinan
5. Verifikasi portofolio: GitHub REST API (SSRF-guarded), dilewati adaptif untuk peran
   non-teknis
6. Skor 4 dimensi deterministik: SKILL 40 / EXPERIENCE 30 / EDUCATION 10 / PORTFOLIO
   20, dihitung Python murni, plus audit tumpang tindih tanggal kerja dan inflasi
   jabatan (`backend/app/core/scoring.py`)
7. Konsensus dua model dan simulasi wawancara: selisih bacaan menurunkan keyakinan,
   soal wawancara disusun dari celah kompetensi kandidat
8. Keputusan akhir dan penguncian slot: rekomendasi, pencarian slot kosong secara
   atomik, lalu berhenti di antrean `waiting_approval`

## Yang sudah jalan

- Portal karier publik: daftar lowongan, lamaran tanpa akun, token pelacakan rahasia,
  dan halaman lacak mandiri
- Notifikasi email otomatis per perubahan status (lamaran diterima, permintaan
  informasi tambahan, jadwal wawancara, konfirmasi hapus data) lewat Resend, dengan
  pengiriman best-effort: kegagalan email tidak menghentikan triase
- Panel HR: antrean triage, dossier kandidat, Candidate Evidence Graph, Agent Trace,
  simulasi wawancara, dan scorecard pasca-wawancara
- "What-If?" policy simulator untuk menguji sensitivitas ambang skor
- Modul blog portal karier yang dikelola dari panel admin: kategori, gambar sampul,
  draf atau terbit, estimasi waktu baca dihitung otomatis
- Audit bahasa lowongan dan skor inklusivitas di portal publik
- Jejak audit append-only, log akses PII, dan Right to Erasure lewat crypto-shredding

## Stack

| Lapisan | Pilihan |
|---|---|
| Frontend | React 18.3, Vite 5.4, Tailwind 3.4, @xyflow/react (React Flow 12) |
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy async (`aiomysql`) |
| Basis data | MariaDB 10.11 / InnoDB, 14 tabel 3NF (`backend/migrations`) |
| Kripto | AES-256-GCM envelope encryption (DEK/KEK), blind index SHA-256 + salt |
| Auth | JWT + blacklist in-memory, PBKDF2-HMAC-SHA256 (100k iterasi), kunci 15 menit setelah 5 kali gagal |
| LLM | Gateway kompatibel-OpenAI (`LLM_ROUTER_BASE_URL`), model utama dan cadangan lewat env |
| Email | Resend (API HTTPS atau SMTP relay), `EMAIL_PROVIDER` menentukan status aktif |
| Proxy | Nginx: TLS, HTTP/2, gzip, rate limit 5 r/m pada endpoint lamaran publik |

## Quickstart

```bash
# Backend
cd backend
python -m venv ../.venv && ../.venv/Scripts/activate      # Windows
pip install -r requirements.txt
cp .env.example .env        # isi DATABASE_URL, MASTER_KEK, HMAC_PEPPER, JWT_SECRET
python scripts/init_db.py   # menerapkan backend/migrations/*.sql berurutan
SEED_DEFAULT_PASSWORD='<strong-password>' python scripts/seed_data.py
uvicorn app.main:app --reload --port 8002

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Tes backend (tidak butuh database; tes yang menyentuh DB memakai fake/in-memory):

```bash
cd backend && ../.venv/Scripts/python.exe -m pytest -q
```

## Struktur repositori

```
backend/app/api/         endpoint REST (auth, careers, candidates, jobs, slots, blog, audit)
backend/app/core/        orkestrasi agen, skoring, kripto, sanitizer, detektor, erasure
backend/app/adapters/    GitHub REST + adapter kalender
backend/migrations/      DDL 001-010, dijalankan scripts/init_db.py
backend/data/            golden dataset: 25 CV sintetis + 4 fixture pra-cache
backend/tests/           suite pytest
frontend/src/            aplikasi React (portal karier, panel HR, evidence graph, what-if studio)
nginx/                   konfigurasi reverse proxy produksi
docs/                    PRD, log status, worklog, dokumen lomba
```

## Dokumen dan aset lomba

| Berkas | Isi |
|---|---|
| `docs/docsLomba/GTNIC2026_AIAgent_DoaIbu.pdf` | proposal final |
| `docs/docsLomba/PROPOSAL_AI_RECRUITMENT_AGENT.md` | sumber markdown proposal, dibangun `_build_proposal.py` |
| `docs/docsLomba/pitch_deck/` | pitch deck 6 slide (HTML interaktif, PDF, PNG 1920x1080) |
| `docs/docsLomba/scriptvideo.md` | naskah video demo, pemetaan aset, dan checklist rekaman |
| `docs/docsLomba/demo_cv/` | paket CV demo, generator, dan skrip verifikasi detektor |
| `docs/docsLomba/assets/` | tangkapan layar antarmuka dan diagram arsitektur |
| `docs/worklogs/` | worklog per anggota tim |

Paket CV demo membuktikan setiap detektor bekerja. Unggah `cv_01` untuk alur normal
(`STRONG_MATCH`), lalu `cv_14` untuk berkas curang berlapis yang memicu karantina
keamanan, tumpang tindih 24 bulan, inflasi klaim pengalaman, inflasi jabatan, dan jeda
karier dalam satu unggahan. Perintah lengkap ada di `demo_cv/README.md`.

## Batasan operasional (baca sebelum deploy)

- **Satu worker Uvicorn.** Tanpa Redis, tiket SSE dan semaphore triase bersifat
  per-proses. `--workers 2` memutus aliran trace secara diam-diam.
- **Tidak ada kredensial eksternal di dalam repo.** `GOOGLE_CLIENT_ID`/`SECRET`,
  `RESEND_API_KEY`, dan kunci gateway LLM kosong secara bawaan; jalur kalender, email,
  dan ekstraksi melaporkan status aslinya alih-alih berpura-pura berhasil.
- **Tanpa API key gateway, ekstraksi jatuh ke mesin heuristik** dan penyebabnya
  dicatat di jejak audit.
- **`DEMO_PURGE_ENABLED` bernilai `False`.** Purge 4 jam menghapus setiap kandidat,
  termasuk dataset penjurian; baru aman setelah ada kolom `is_demo`.
- **Pakai data sintetis** untuk demo publik. `DemoDataBanner` mengingatkan pengguna.
- **Berkas scan tanpa lapisan teks belum dibaca substansinya**, hanya ditandai butuh OCR.

## Perlindungan data

Identitas kandidat dienkripsi per record (AES-256-GCM, DEK unik dibungkus KEK master).
Right to Erasure memusnahkan DEK dan menimpa blind index (`core/erasure.py`), sementara
jejak audit tetap utuh. Unmasking diblokir selama blind review, dan setiap akses dicatat
di `pii_access_logs`.
