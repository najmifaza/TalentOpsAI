# PANDUAN DEPLOYMENT & HARDENING NGINX (SPRINT 5) - TALENTOPS AI

Dokumen ini memuat prosedur instalasi, konfigurasi, dan verifikasi reverse proxy Nginx pada Ubuntu VPS untuk backend TalentOps AI (`api-talentops.fawt.biz.id`).

---

## 1. File Konfigurasi
* File konfigurasi produksi: `nginx/talentops.conf`
* Target lokasi VPS: `/etc/nginx/sites-available/talentops.conf`
* Symlink aktif: `/etc/nginx/sites-enabled/talentops.conf`

---

## 2. Fitur Keamanan & Performa yang Diimplementasikan
1. **SSL Labs Grade A+ Hardening:**
   * TLS v1.2 & TLS v1.3 only dengan cipher suites modern (ECDHE-ECDSA/RSA AES-GCM).
   * SSL session cache shared 50MB (efisiensi memory & handshake 1d).
   * OCSP Stapling aktif dengan Cloudflare/Google DNS resolver (1.1.1.1, 8.8.8.8).
   * HSTS preload (`max-age=63072000; includeSubDomains; preload`).
2. **Keamanan Header HTTP (OWASP Recommended):**
   * `X-Frame-Options: DENY` (anti-clickjacking).
   * `X-Content-Type-Options: nosniff` (anti-MIME-sniffing).
   * `X-XSS-Protection: 1; mode=block`.
   * `Referrer-Policy: strict-origin-when-cross-origin`.
   * `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
3. **Optimasi Khusus Server-Sent Events (SSE):**
   * Endpoint `/api/candidates/stream/:id` dan `/api/candidates/:id/trace-stream` dikonfigurasi dengan:
     * `proxy_buffering off;`
     * `chunked_transfer_encoding off;`
     * `proxy_cache off;`
     * `proxy_read_timeout 300s;`
     * `proxy_set_header Connection "";` (upstream keep-alive).
4. **Proteksi Rate Limiting Berbasis IP (PRD Bab 6.1):**
   * Endpoint pelamar `/api/careers/{id}/apply` dibatasi maksimal **5 request/menit** (`zone=talentops_apply_limit`).
   * Endpoint umum dibatasi **30 request/detik** (`zone=talentops_api_limit`).
   * Respon elegan JSON HTTP 429 saat batas terlampaui.
5. **Connection Pooling Upstream:**
   * `keepalive 64;` ke Uvicorn port 8002 untuk memangkas TCP handshake overhead.

---

## 3. Langkah Instalasi di VPS Ubuntu

```bash
# 1. Salin konfigurasi ke sites-available
sudo cp /var/www/talentops/nginx/talentops.conf /etc/nginx/sites-available/talentops.conf

# 2. Buat symlink ke sites-enabled
sudo ln -sf /etc/nginx/sites-available/talentops.conf /etc/nginx/sites-enabled/

# 3. Validasi sintaks Nginx
sudo nginx -t

# 4. Reload layanan Nginx tanpa downtime
sudo systemctl reload nginx
```

---

## 4. Sertifikat SSL Let's Encrypt (Certbot)
Jika sertifikat baru dibutuhkan:
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d api.talentops.ai.id --agree-tos --email admin@talentops.id
```

---

## 5. Verifikasi Status Live
* Endpoint Health: `curl -I https://api.talentops.ai.id/api/health`
* Swagger Docs: `https://api.talentops.ai.id/docs`
* Header Check:
```bash
curl -I https://api.talentops.ai.id/api/health | grep -iE "strict-transport|x-frame|x-content"
```
