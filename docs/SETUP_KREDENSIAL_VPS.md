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

## 3. GOOGLE CALENDAR (OAUTH2)

### Kegunaan

`google_calendar_adapter` (`backend/app/adapters/google_calendar.py`) membuat event
kalender saat HR menyetujui kandidat dan memilih slot wawancara. Alur OAuth ada di
`backend/app/api/calendar_oauth.py`:

| Endpoint | Fungsi |
|---|---|
| `GET /api/calendar/status` | apakah server terkonfigurasi & user terhubung |
| `GET /api/calendar/oauth/authorize` | URL consent Google + `state` nonce (CSRF) |
| `GET /api/calendar/oauth/callback` | menukar `code` menjadi token, disimpan terenkripsi |

`state` disimpan di Redis bila tersedia, atau in-memory saat single worker
(`calendar_oauth.py:44`). Karena service berjalan `--workers 1`, fallback in-memory
cukup — jangan menaikkan jumlah worker tanpa mengisi `REDIS_URL`.

### Langkah

1. Buka https://console.cloud.google.com → buat project `talentops-ai`
2. **APIs & Services** → **Library** → cari **Google Calendar API** → **Enable**
3. **APIs & Services** → **OAuth consent screen**:
   - User type: **External**
   - App name `TalentOps AI`, email support Anda
   - Scopes: `https://www.googleapis.com/auth/calendar.events` dan
     `https://www.googleapis.com/auth/calendar.readonly`
   - **Test users**: tambahkan alamat Gmail yang akan dipakai saat demo
   - Status **Testing** sudah cukup; verifikasi Google tidak diperlukan untuk demo
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**:
   - Application type: **Web application**
   - Name: `TalentOps Backend`
   - **Authorized redirect URIs**:
     `https://api-talentops.fawt.biz.id/api/calendar/oauth/callback`
   - Harus persis, tanpa trailing slash. Beda satu karakter → Google menolak dengan
     `redirect_uri_mismatch`.
5. Salin **Client ID** (berakhiran `.apps.googleusercontent.com`) dan **Client secret**

### Pasang

```dotenv
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
GOOGLE_REDIRECT_URI="https://api-talentops.fawt.biz.id/api/calendar/oauth/callback"
GOOGLE_CALENDAR_ID="primary"
```

```bash
sudo systemctl restart talentops-backend
```

### Verifikasi

```bash
curl -s https://api-talentops.fawt.biz.id/api/calendar/status \
  -H "Authorization: Bearer $JWT"
```

Yang diharapkan: `"configured": true` dan `"connected": false` (belum ada user yang
menghubungkan akun). Kalau `"configured": false`, kredensial belum terbaca.

Hubungkan akun:

```bash
curl -s https://api-talentops.fawt.biz.id/api/calendar/oauth/authorize \
  -H "Authorization: Bearer $JWT"
```

Buka `auth_url` di browser, setujui consent, callback akan mengarahkan kembali ke
`https://talentops.ai.id/admin/dashboard` (nilai `OAUTH_SUCCESS_REDIRECT`). Ulangi
`/api/calendar/status` — sekarang harus `"connected": true`.

### Catatan

- Penguncian slot (`tentative`/TTL) masih memakai `mock_calendar_adapter`
  (`slots.py:10`). Yang asli hanya pembuatan event. Jangan mengklaim seluruh alur
  kalender sudah live.
- Token akses disimpan terenkripsi per user di database, bukan di `.env`.

---

## 4. Ringkasan Status Setelah Setup

| Kredensial | Variabel wajib | Dampak bila kosong |
|---|---|---|
| GitHub | `GITHUB_TOKEN` | kuota 60 req/jam; triage batch mudah kena `RATE_LIMITED` |
| Resend | `EMAIL_PROVIDER` + `RESEND_API_KEY` + `EMAIL_FROM` | email keputusan tidak terkirim (`EMAIL_NOT_CONFIGURED`) |
| Google | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` | event kalender tidak dibuat; status `configured: false` |

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
