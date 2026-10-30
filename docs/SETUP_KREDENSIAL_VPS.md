# SETUP KREDENSIAL PRODUKSI (VPS)

Dokumen ini mencatat cara mengisi tiga kredensial eksternal yang masih kosong di
`backend/.env` VPS, beserta cara memverifikasi bahwa nilainya benar-benar terbaca
oleh aplikasi.

Semua perintah dijalankan di VPS sebagai `willynaren`, dari `/var/www/talentops`.

- Backend: `https://api-talentops.fawt.biz.id`
- Frontend: `https://talentops.ai.id`
- Service: `talentops-backend` (`ExecStart` memakai `--workers 1`)
- File konfigurasi: `backend/.env` (sudah masuk `.gitignore`)

---

## 0. Aturan Keselamatan

1. **Jangan pernah menaruh nilai asli di `.env.example`.** File itu ikut repository.
   Yang asli hanya di `backend/.env`, yang sudah di-ignore (`.gitignore:16`).
2. **Jangan mengedit `.env` lewat agy (Antigravity CLI).** CLI itu merekam output tool
   ke `~/.gemini/antigravity-cli/brain/steps/*/output.txt`, termasuk isi file dan
   header `Authorization`. Pakai terminal biasa.
3. **Jangan pernah menjalankan perintah yang mencetak token ke layar bersama.**
   Setelah selesai, jalankan `history -c` bila token sempat masuk ke argumen perintah.
4. Setiap perubahan `backend/.env` **wajib** diikuti
   `sudo systemctl restart talentops-backend`. Uvicorn membaca `.env` sekali saat start.
5. `DEMO_PURGE_ENABLED` **harus tetap `false`** di DB lomba. Job purge menghapus semua
   kandidat lebih tua dari 4 jam karena tidak ada kolom penanda unggahan demo.

---

## 1. GITHUB_TOKEN

### Kegunaan

`GitHubAdapter` (`backend/app/adapters/github.py:30`) memanggil
`GET https://api.github.com/repos/{owner}/{repo}` untuk mengambil bahasa utama,
jumlah star/fork, dan status fork. Dipakai `triage_service.py:207` saat triage
berjalan, dan hasilnya memengaruhi skor Tier 3 (100 vs 60).

Yang dibaca hanya metadata repo **publik**. Tidak perlu scope apa pun. Token di sini
hanya menaikkan kuota dari 60 request/jam (anonim) menjadi 5.000 request/jam.

### Langkah

**Opsi A — classic token (paling cepat)**

1. Buka https://github.com/settings/tokens
2. **Generate new token** → **Generate new token (classic)**
3. Note: `talentops-triage`
4. Expiration: 90 days
5. Scopes: **kosongkan semua.** Centang `repo` justru memberi akses tulis ke seluruh
   repository akun Anda dan tidak dibutuhkan.
6. **Generate token**, salin nilai berawalan `ghp_` (ditampilkan sekali).

**Opsi B — fine-grained (lebih ketat)**

1. Buka https://github.com/settings/tokens?type=beta
2. **Generate new token**
3. Repository access: **Public Repositories (read-only)**
4. Permissions: kosongkan
5. Salin nilai berawalan `github_pat_`

### Pasang

```bash
cd /var/www/talentops
nano backend/.env
```

```dotenv
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Simpan (`Ctrl+O`, `Enter`, `Ctrl+X`), lalu:

```bash
sudo systemctl restart talentops-backend
```

### Verifikasi

```bash
cd /var/www/talentops
TOKEN=$(grep '^GITHUB_TOKEN=' backend/.env | cut -d'"' -f2)
echo "panjang token: ${#TOKEN}"
curl -s -H "Authorization: Bearer $TOKEN" https://api.github.com/rate_limit \
  | tr -d ' \n' | grep -o '"core":{[^}]*}'
```

- `panjang token` ≈ 40 (`ghp_`) atau ≈ 93 (`github_pat_`). Kalau `0`, baris di `.env`
  masih kosong atau kutipnya tidak pas.
- Hasil yang benar: `"core":{"limit":5000,...}`.
- Kalau muncul `"limit":60`, token tidak terbaca — periksa spasi/kutip nyangkut, atau
  perintah dijalankan di mesin lain (token hanya ada di `.env` VPS).

### Catatan demo

Kandidat seed memakai URL repo **fiktif**
(`https://github.com/candidate/payment-service`, `https://github.com/reza/order-service`).
GitHub akan membalas 404, sehingga klaim Tier 3 turun ke Tier 2 dan skor berubah saat
triage ulang. Untuk skor demo yang stabil, ganti `github_url` di
`backend/scripts/seed_demo_candidates.py` dengan repo publik yang benar-benar ada.

Hasil verifikasi repo **tidak disimpan** ke kolom mana pun; ia hanya hidup di memori
selama triage. Kolom `AUDIT GITHUB` di dashboard membaca ada/tidaknya `candidates.github_url`,
karena itu labelnya "Repo Terdaftar", bukan "Terverifikasi".

---

## 2. EMAIL (RESEND)

### Kegunaan

`EmailService` (`backend/app/core/email.py`) mengirim email transaksional: notifikasi
keputusan akhir ke pelamar (`candidates.py:168`), konfirmasi lamaran, dan konfirmasi
erasure (`careers.py:327`, `careers.py:449`).

Ada **dua** variabel yang harus diisi. Mengisi `RESEND_API_KEY` saja tidak cukup —
`configured` tetap `False` selama `EMAIL_PROVIDER` kosong (`email.py:55`), dan semua
pengiriman akan mengembalikan `EMAIL_NOT_CONFIGURED`.

### Langkah

1. Daftar/login di https://resend.com
2. **Domains** → **Add Domain** → isi `talentops.ai.id` → region Singapore
3. Tambahkan record DNS yang ditampilkan Resend ke panel registrar domain:
   - `MX` (feedback)
   - `TXT` SPF
   - `TXT` DKIM (`resend._domainkey`)
   - opsional `TXT` DMARC
4. Tunggu status domain **Verified** (umumnya 5–30 menit)
5. **API Keys** → **Create API Key** → permission **Sending access** → salin nilai
   berawalan `re_`

### Pasang

```dotenv
EMAIL_PROVIDER="resend_api"
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="TalentOps AI <noreply@talentops.ai.id>"
```

Alternatif relay SMTP (bila port 443 diblokir): `EMAIL_PROVIDER="resend_smtp"`,
dengan `RESEND_SMTP_HOST="smtp.resend.com"` dan `RESEND_SMTP_PORT=465` (nilai default
sudah benar, tidak perlu ditulis ulang).

```bash
sudo systemctl restart talentops-backend
```

### Verifikasi

Tidak ada endpoint status email. Verifikasi lewat dua jalur.

Pertama, pastikan nilai terbaca oleh proses. `backend/.env` dibaca pydantic-settings,
bukan systemd, jadi `systemctl show -p Environment` tidak akan menampilkannya:

```bash
cd /var/www/talentops/backend
../.venv/bin/python -c "
from app.core.config import settings
from app.core.email import email_service
print('provider :', repr(settings.EMAIL_PROVIDER))
print('key set  :', bool(settings.RESEND_API_KEY))
print('from     :', settings.EMAIL_FROM)
print('configured:', email_service.configured)
"
```

Yang diharapkan: `configured: True`. Kalau `provider` kosong (`''`), `EMAIL_PROVIDER`
belum diisi. Kalau `key set: False`, `RESEND_API_KEY` belum diisi.

Kedua, kirim keputusan nyata ke satu kandidat. Pengiriman terjadi di dalam endpoint
review (`candidates.py:533`), bukan endpoint terpisah:

```bash
curl -s -X POST https://api-talentops.fawt.biz.id/api/candidates/1/review \
  -H "Authorization: Bearer $JWT" \
  -F "decision=REJECT_CONFIRMED" \
  -F "notes=uji konfigurasi email"
```

Perhatikan bagian `email` pada respons. Yang benar:
`{"sent": true, "provider": "resend_api", ...}`.
Kalau `{"sent": false, "reason": "EMAIL_NOT_CONFIGURED"}`, `EMAIL_PROVIDER` belum diisi
atau service belum di-restart.

**Peringatan:** endpoint ini mengubah status kandidat secara permanen dan tercatat
append-only di `human_reviews`. Untuk uji konfigurasi, pakai kandidat yang memang boleh
ditolak — jangan kandidat yang akan dipakai saat penjurian.

### Catatan

Tanpa akses DNS `talentops.ai.id`, `onboarding@resend.dev` bisa dipakai sebagai
`EMAIL_FROM`, tetapi Resend hanya mengizinkannya mengirim ke alamat pemilik akun.
Tidak cukup untuk demo ke pelamar.

---

## 3. KALENDER WAWANCARA (SOVEREIGN CALENDAR ENGINE)

### Status & Keputusan Arsitektur

TalentOps AI menggunakan **Internal Sovereign Calendar Engine** berbasis transaksi MariaDB ACID (`SELECT ... FOR UPDATE` urutan baku `users` -> `interview_slots` -> `candidates`). 

1. **Zero External Dependency:** Tidak memerlukan kredensial Google OAuth2 (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) di backend. Seluruh data jadwal tersimpan 100% lokal on-premise untuk menjamin kedaulatan data subjek hukum sesuai UU PDP No. 27/2022.
2. **Ekspor 1-Klik ke Google Calendar Pribadi:** Antarmuka admin dan dossier kandidat menyediakan tombol langsung `Ekspor ke Google Calendar Pribadi` berbasis URL template web Google Calendar resmi (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`). Pewawancara atau kandidat dapat menyimpan jadwal ke akun Google Calendar pribadi mereka secara instan tanpa perlu memberikan izin OAuth kepada server.

---

## 4. Ringkasan Status Setelah Setup

| Kredensial | Variabel wajib | Dampak bila kosong |
|---|---|---|
| GitHub | `GITHUB_TOKEN` | Kuota 60 req/jam; jika diisi, naik ke 5.000 req/jam |
| Resend | `EMAIL_PROVIDER` + `RESEND_API_KEY` + `EMAIL_FROM` | Email keputusan tidak terkirim (`EMAIL_NOT_CONFIGURED`) |
| Kalender | *(Tanpa Kredensial)* | 100% aktif via Sovereign Calendar & ekspor URL personal |

Kredensial lain yang tidak boleh diubah sembarangan: `MASTER_KEK` dan `HMAC_PEPPER`
mengenkripsi seluruh PII kandidat. Mengganti `MASTER_KEK` membuat semua data lama tidak
bisa didekripsi; mengganti `HMAC_PEPPER` memutus `email_blind_index` sehingga pencarian
berdasarkan email berhenti cocok.

Kredensial lain yang tidak boleh diubah sembarangan: `MASTER_KEK` dan `HMAC_PEPPER`
mengenkripsi seluruh PII kandidat. Mengganti `MASTER_KEK` membuat semua data lama tidak
bisa didekripsi; mengganti `HMAC_PEPPER` memutus `email_blind_index` sehingga pencarian
berdasarkan email berhenti cocok.

---

## 5. Checklist Deploy

```bash
cd /var/www/talentops
git pull origin main
sudo systemctl restart talentops-backend
systemctl is-active talentops-backend
systemctl cat talentops-backend | grep -i exec    # pastikan --workers 1
sudo journalctl -u talentops-backend -n 40 --no-pager | grep -iE "error|Traceback|maintenance"
curl -s https://api-talentops.fawt.biz.id/api/health
```

Rollback bila perlu:

```bash
git checkout <commit-sebelumnya> && sudo systemctl restart talentops-backend
```
