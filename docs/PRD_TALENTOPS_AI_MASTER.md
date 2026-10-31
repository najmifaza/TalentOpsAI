# PRODUCT REQUIREMENT DOCUMENT (PRD) - TALENTOPS AI

## Project Name: TalentOps AI

**Subtitle:** Human-Centric Agentic Recruitment Web Ecosystem: Interconnected Evidence-Based Hiring & Decision Intelligence  
**Target Competitions (Dual-Target):**

1. **Web Development Competition - UINIC 8.0 (2026)**
   - _Grand Theme:_ “Empowering a Sustainable Digital Ecosystem”
   - _Category Theme:_ “Engineering Interconnected Web Solutions to Empower Digital Ecosystems”
   - _Subtheme:_ Artificial Intelligence (AI) & Teknologi Digital (SDGs 8 & 9)
   - _Deliverables:_ Proposal 30 Halaman (15 Bab) + GitHub Repo + Live Demo Web
2. **AI Agent Development Competition - GTNIC 2026 (Garda Tech)**
   - _Grand Theme:_ “Innovation for a Better Future”
   - _Subtheme:_ “Building Intelligent AI Agents for Enterprise Productivity”
   - _Focus Area:_ Enterprise & Industry (AI Recruitment Agent)
   - _Deliverables:_ Proposal 15 Halaman + Video Demo 3–5 Menit + Live Interface & Repo

**Document Version:** 2.6.0 (Universal Recruitment Architecture: Dynamic Taxonomies, Non-IT Adaptive Scoring, and Domain-Agnostic Flow)  
**Status:** Approved for Implementation & Competition Submission  
**Authors:** Tim Pengembang TalentOps AI (System Architecture, AI Engineering, Full-Stack Web & Compliance)

---

### Riwayat Versi Dokumen (Changelog)

| Versi      | Tanggal    | Inisiator | Ringkasan Pembaruan Utama                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v2.0.0** | 2026-10-17 | Core Team | Inisialisasi strategi Dual-Track (Live Demo MVP vs Enterprise Target Architecture), Model Adapter 9router (Gemini 3.8), dan pembersihan dependensi eksternal berat.                                                                                                                                                                                                                                                                            |
| **v2.1.0** | 2026-10-17 | Core Team | Hardening Menuju Kemenangan (Review Alignment): Regex Tier 3, Transparansi DPA, Koreksi formula, Fleksibilitas kalender, Jadwal anti-bottleneck.                                                                                                                                                                                                                                                                                               |
| **v2.2.0** | 2026-10-17 | Core Team | Dual-Ingestion & Governed On-Demand Triage: Public Career Portal, status `queued`, trigger on-demand single/batch triage.                                                                                                                                                                                                                                                                                                                      |
| **v2.3.0** | 2026-10-17 | Core Team | Audit & Hardening Menyeluruh: `encrypted_email`, `encrypted_dek`, `tracking_token`, perbaikan default kolom penilaian, koreksi latensi p50/p95, Counterfactual Fairness Test.                                                                                                                                                                                                                                                                  |
| **v2.4.0** | 2026-10-17 | Core Team | Production-Grade Audit: Harmonisasi SDG 8, pembersihan domain pribadi CSP, kriteria `has_implementation_detail`, flag `triage_priority`, proteksi endpoint `/apply`, kelengkapan endpoint RBAC, break-even unit economics.                                                                                                                                                                                                                     |
| **v2.5.0** | 2026-10-17 | Core Team | Hardening Menuju Kemenangan (Pre-Code Lock): Non-overlap kalender transaksional, skema JSON `has_implementation_detail`, CSP vercel.json, perapian jadwal.                                                                                                                                                                                                                                                                                     |
| **v2.5.1** | 2026-10-17 | Core Team | Final Structural & Concurrency Closure: Resolusi Erasure vs Append-Only, serialisasi kunci pewawancara, sinkronisasi cleaner task, pembersihan rujukan pasal UU PDP, baseline dataset 20-30 resume sintetis.                                                                                                                                                                                                                                   |
| **v2.5.2** | 2026-10-17 | Core Team | **Implementation Consistency Lock:** <br>1. Harmonisasi urutan kunci transaksional baku (`users` -> `interview_slots` -> `candidates`) pada seluruh alur termasuk `POST /api/candidates/{id}/review`.<br>2. Integrasi endpoint `DELETE /api/candidates/{id}` ke service terpadu `talentops_erasure`.<br>3. Penegasan soft deletion kriptografis (`is_deleted = TRUE` tanpa physical delete).<br>4. Perapian visual diagram arsitektur Bab 3.1. |
| **v2.5.3** | 2026-10-18 | Core Team | **Production Deployment & Driver Compatibility Hardening:** <br>1. Integrasi Vercel Edge Serverless Proxy Rewrite (`/api/(.*)` -> VPS Backend `https://api-talentops.fawt.biz.id`) untuk mengeliminasi latensi CORS preflight pada custom domain `https://talentops.fawt.biz.id`.<br>2. Resolusi kompatibilitas driver biner `aiomysql` + `pymysql<=1.1.1` dengan runtime adapter `escape_bytes_prefixed` untuk penanganan parameter biner AES-256-GCM (`VARBINARY(255)`).<br>3. Penegakan format baku RFC 4122 UUIDv4 36-karakter untuk `tracking_token` dengan mekanisme client auto-healing.<br>4. Resiliensi modal Live SSE Agent Trace via Watchdog Timer 1.5s dengan auto-fallback deterministik.<br>5. Integrasi langsung tata kelola privasi UU PDP No. 27/2022 pada Public Career Portal (`/careers/apply` & `/careers/track`) dan Candidate Dossier modal. |
| **v2.5.4** | 2026-10-22 | Core Team | **Full Codebase Synchronization & Portal Expansion:** <br>1. Integrasi tabel `blog_posts` (13 tabel inti) dan RBAC endpoint Blog CMS (`/api/blog`) serta portal publik artikel.<br>2. Harmonisasi skema `job_descriptions` (+12 kolom profil publik migrasi 005), `candidates` (`masked_name_hint` migrasi 004), dan `candidate_evidence` (`matched_requirement`, `verified` migrasi 003).<br>3. Sinkronisasi alur Dropzone HR dengan form `applicant_meta` (nama & email asli) dan dictionary PII sanitization.<br>4. Dokumentasi endpoint OAuth & status kalender (`/api/calendar/*`).<br>5. Transparansi status flag `DEMO_PURGE_ENABLED=False` (default nonaktif demi integritas dataset golden penjurian) dan penempatan banner data sintetis di dashboard. |
| **v2.6.0** | 2026-10-31 | Core Team | **Universal Recruitment Expansion & Domain-Agnostic Engine:** <br>1. Transformasi sistem dari IT-only menjadi Universal Domain Rekrutmen (Finance, HR, Legal, Marketing, Sales, Medis, dll).<br>2. Integrasi kolom `is_tech_role` (TINYINT) dan kamus sinonim dinamis `competency_taxonomies` (JSON) pada `job_descriptions` (Migrasi 007).<br>3. Auto-detection domain pekerjaan (`infer_is_tech_role`) dan generator taksonomi dinamis per lowongan (`generate_dynamic_taxonomies`).<br>4. Scoring adaptif non-IT: portofolio dinilai dari tautan universal (Drive, Notion, Behance, LinkedIn) tanpa penalti 0 GitHub; pengakuan jenjang pendidikan (S1, S2, D3) tanpa pemaksaan rumpun komputer.<br>5. Ekspansi metrik kuantitatif ke domain bisnis & operasional (`omzet`, `revenue`, `closing`, `leads`, `sla`, `turnover`, `kepatuhan`, dll).<br>6. Generator skenario wawancara adaptif kontekstual sesuai posisi jabatan pelamar.<br>7. Kondisional input frontend: Input GitHub otomatis disembunyikan pada formulir pelamar posisi non-IT (`JobApplyPage` & `CareerPortal`), dan node audit GitHub disembunyikan pada `EvidenceGraph`. |

---

## 1. EXECUTIVE SUMMARY & VALUE PROPOSITION

### 1.1 Problem Statement & Baseline Asumsi

Proses rekrutmen talenta teknologi (_engineering hiring_) pada industri digital nasional menghadapi inefisiensi kritis:

1. **Inefisiensi Operasional (_Decision Fatigue_):** Mengacu pada asumsi dasar benchmark industri (_SHRM Talent Acquisition In-Depth Technical Review Benchmark_), peninjauan berkas dossier teknis secara mendalam (evaluasi klaim arsitektur, verifikasi kronologi karier, dan pengecekan repositori) memakan waktu rata-rata **480 detik (8 menit)** per kandidat (berbeda dengan _glance screening_ visual awal yang hanya 6–10 detik). Volume 500 pelamar membutuhkan $\pm 66.7$ jam kerja tim Talent Acquisition (TA), memicu kelelahan kognitif (_decision fatigue_) dan inkonsistensi penilaian subjektif antar-kandidat.
2. **Kerapuhan ATS Konvensional (_Keyword Stuffing & Fraud_):** Applicant Tracking System berbasis pencocokan kata kunci statis rentan dimanipulasi melalui teks tersembunyi (font putih/0pt/DOCX `w:vanish`) atau pengulangan istilah (_keyword stuffing_), namun buta terhadap anomali kronologi karier (_overlapping dates_, klaim jabatan fiktif).
3. **Ketertutupan Algoritmik & Risiko Hukum (_Black-Box Dilemma_):** Solusi AI screening generasi awal sering berupa pembungkus LLM (_wrapper_) tanpa dasar rujukan bukti (_untraceable score_). Hal ini menimbulkan bias diskriminatif serta berisiko melanggar hak subjek data berdasarkan **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)** dan asas nondiskriminasi **UU No. 13 Tahun 2003 tentang Ketenagakerjaan (Pasal 5 & 6)**.
4. **Kerapuhan Ketergantungan Model Tunggal (_Deprecation Risk_):** Mengandalkan satu model komersial tertentu secara kaku membahayakan kelangsungan operasional sistem ketika model mengalami pembaruan atau pemensiunan (_lifecycle deprecation_).

### 1.2 Solusi yang Diusulkan: Human-Centric Agentic Ecosystem

**TalentOps AI** memadukan prinsip **Constrained Agentic Workflow** dengan pengawasan manusia mutlak (_Human-in-the-Loop / HITL_):

- **Arsitektur Penilaian Berbasis Bukti (_Evidence-Based Scoring_):** Menggunakan **Adaptive Model Adapter Layer** yang terhubung ke **9router LLM Gateway** (Provider: **Antigravity**, Target Model: **Gemini 3.8**, suhu 0.0 dengan deterministik cache `file_hash` yang dinonaktifkan secara eksplisit saat uji determinisme). LLM bertindak sebagai ekstraktor fakta terstruktur dan pengidentifikasi anomali. Kalkulasi skor 4D dihitung deterministik oleh backend Python berbasis ketercakupan kompetensi inti (_core competencies coverage_) dan taksonomi teknologi.
- **Interkoneksi Ekosistem Web Nyata (_Interconnected Digital Ecosystem_):**
  - Integrasi Google Calendar OAuth2 `[TARGET]` — kode terpasang: alur otorisasi OAuth2, penyimpanan token terenkripsi, `create_event` saat approval, dan `list_upcoming_events`. Adapter lokal `MockCalendarAdapter` tetap dipakai untuk penguncian slot atomik di database (anti double-booking), sehingga demo tetap jalan tanpa kredensial. Status: belum diverifikasi live karena `GOOGLE_CLIENT_ID`/`SECRET` masih kosong.
  - GitHub REST API v3 `[MVP]` (verifikasi eksistensi repositori publik, kepemilikan/forks, bahasa utama, & topics).
  - Notifikasi email transaksional via Resend `[TARGET]` — kode terpasang dua jalur (`resend_api` HTTPS dan `resend_smtp` relay), dengan mode `disabled` yang jujur saat kunci kosong. Status: belum diverifikasi live karena `RESEND_API_KEY` masih kosong.
  - SSE Trace Streaming `[MVP]` (siaran langkah otonom agen secara real-time ke UI).

### 1.3 Key Value Proposition & Target Kinerja Terukur

- **Akselerasi Triage & Efisiensi HR:** Memangkas beban kerja manual dari baseline tinjauan mendalam 480 detik (8 menit) menjadi evaluasi mesin dengan target desain latensi $\le 15.000\text{ ms}$ (target p50 = 5.730 ms, p95 = 10.010 ms) ditambah tinjauan dossier terfokus oleh HR selama $\pm 90-120\text{ detik}$, menghasilkan efisiensi waktu operasional manusia sebesar $\approx 75\% - 80\%$.
- **Ketertelusuran Bukti 100%:** Setiap poin skor ditautkan ke kutipan resume tersanitasi (_verbatim substring_) atau metadata repositori terverifikasi via _Candidate Evidence Graph_ interaktif (React Flow).
- **Keadilan Seleksi (Fairness Target):** Menargetkan kelulusan _Counterfactual Fairness Test_ dengan selisih skor antar-varian demografi $\le 1.0$ poin pada skala 100 dan keselarasan kategori rekomendasi 100% saat identitas demografi (nama, gender, dan almamater) dipertukarkan pada resume sintetis identik, menjamin kepatuhan audit non-diskriminasi UU Ketenagakerjaan No. 13/2003.
- **Integritas Reservasi Kalender:** Nol insiden pemesanan ganda (_zero double-booking target_) pada pengujian konkurensi 50 transaksi reservasi simultan dengan lock versioning & interval non-overlap check.

---

## 2. STRATEGI DUAL-TRACK: LIVE DEMO MVP VS TARGET PRODUKSI ENTERPRISE

Untuk memastikan keberhasilan ganda—menghasilkan **Live Web Demo yang 100% stabil, cepat, dan memukau juri** sekaligus menyajikan **Proposal 30 Halaman yang berbobot arsitektur enterprise**—seluruh kapabilitas sistem dikelompokkan secara transparan menggunakan penanda `[MVP]` dan `[TARGET]`:

| Komponen Arsitektur       | Lintasan 1: Live Demo MVP `[MVP]` (Fokus Demo & Video)                                                                                             | Lintasan 2: Target Arsitektur Enterprise `[TARGET]` (Cetak Biru Proposal)                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Lingkup Database**      | 13 Tabel Relasional Inti (Single Default Tenant `tenant_id=1`, MariaDB/InnoDB ACID, termasuk `blog_posts`)                                        | 15 Tabel Relasional Multi-Tenant Penuh dengan Metering Kuota & Tabel `tenants`                   |
| **Manajemen Kunci (KMS)** | Master KEK tersimpan di `.env` aman; Envelope Encryption AES-256-GCM lokal via Python `cryptography`                                               | Dedicated HashiCorp Vault / AWS KMS Cluster dengan isolasi DEK transit engine                    |
| **Integrasi Kalender**    | **Lock atomik di database + Google Calendar OAuth2** (kode terpasang, menunggu kredensial; `MockCalendarAdapter` menangani reservasi slot)                                    | Google Calendar API OAuth2 Two-Way Sync langsung dengan Webhook Push Notification Watch Channel  |
| **Inbound ATS Ingestion** | **Dual-Ingestion UI:** Public Career Portal (`/careers/apply`) + Direct Multi-File Dropzone di HR Dashboard (PDF/DOCX) dengan status awal `queued` | Inbound Webhook Gateway berautentikasi HMAC-SHA256 untuk integrasi Greenhouse/Lever              |
| **Orkestrator LLM**       | **9router Gateway (Provider: Antigravity, Model: Gemini 3.8)** + **Safe Pre-Cached Fallback Mode**                                                 | Multi-Provider Dynamic Fallback Router dengan failover lintas-region & SLA enterprise ber-DPA    |
| **Antrean & Asinkronus**  | **100% In-Memory Python Core:** FastAPI `BackgroundTasks` + `asyncio.Queue` (Live SSE Stream) + `cachetools.LRUCache`                              | Redis Cluster HA terdistribusi dengan Celery/ARQ Worker nodes mandiri                            |
| **Sanitasi PII**          | **High-Performance In-Memory Regex & Rule-Based Sanitizer** (0 MB model overhead, latensi < 20 ms, aman RAM 1 GB)                                  | Microsoft Presidio / Enterprise NER Pipeline terdistribusi dengan Custom Indonesian Entity Model |
| **Autentikasi Pengguna**  | JWT Stateless Authentication (Role: Admin, Recruiter, Hiring Manager, Compliance Officer)                                                          | SSO SAML 2.0 / OAuth2 Enterprise + MFA (TOTP RFC 6238) + Session Blacklisting                    |

---

## 3. KORELASI TEMA LOMBA & INDIKATOR DAMPAK SDG (SDG 8 & 9)

### 3.1 Relevansi Tema: "Engineering Interconnected Web Solutions to Empower Digital Ecosystems"

TalentOps AI menghubungkan simpul ekosistem digital rekrutmen enterprise secara aman, adaptif, dan modular:

```
                      +---------------------------------------+
                      |       TALENT ECOSYSTEM CLIENT         |
                      |   React 18 SPA (Vercel Edge Network)  |
                      |   https://talentops.fawt.biz.id       |
                      |   - Public Career Portal (/careers)   |
                      |   - Evidence Graph (React Flow)       |
                      |   - What-If Simulation Studio         |
                      |   - HITL Review & Calendar Dashboard  |
                      +-------------------+-------------------+
                                          |
                Vercel Edge Proxy Rewrite |  SSE Stream (Replay + Live)
                /api/* -> VPS Backend     |  (Watchdog Fail-Safe 1.5s)
                                          v
+-----------------------------------------------------------------------------+
|                  TALENTOPS AGENTIC BACKEND (FastAPI Core)                   |
|                  https://api-talentops.fawt.biz.id                          |
|                                                                             |
|  [Dual Ingestion Engine] [Governed Agent State Machine]  [Outbound Notif]   |
|  - Career Portal Apply   - On-Demand Single/Batch Trigger- Mock Dispatch    |
|  - HR Direct Dropzone    - Model Adapter (9router/Gemini)  [MVP]            |
|  - PII Encrypt & Consent - Deterministic 4D Scoring      - Webhook/Slack    |
|  - Hidden-Text Guard     - Bounded Self-Healing Engine     [TARGET]         |
+----+--------------------+----+--------------------+----+--------------------+
     |                         |                         |
     v                         v                         v
[External APIs]         [Asynchronous Core (In-Memory)]   [Persistent & Security Core]
- 9router LLM Gateway   - Python In-Memory Core           - MariaDB Core Database
  (Provider: Antigravity  (asyncio.Queue & LRU Cache)       (ACID Relational Core)
  Model: Gemini 3.8)    - FastAPI Async Engine            - Master KEK Envelope Encryption
- GitHub REST API v3      (BackgroundTasks + Semaphore 3)   (AES-256-GCM + Blind Index)
- Calendar Adapter
  (Google Calendar OAuth2 `[TARGET]` + lock atomik DB)
```

### 3.2 Dampak Nyata Terhadap Sustainable Development Goals (SDGs)

1. **SDG 8: Decent Work and Economic Growth (Target 8.5 - Kesempatan Kerja Setara & Bebas Bias):**
   - _Indikator Target:_ Kelulusan _Counterfactual Fairness Test_ dengan selisih skor antar-varian demografi $\le 1.0$ poin pada skala 100 dan keselarasan kategori rekomendasi 100%.
   - _Implementasi:_ Modul _Fairness Guardian_ menyensor identitas pribadi (nama, foto, gender, usia, kontak, nama almamater) sebelum evaluasi. Jeda karier (_career break_) tidak dipenalti secara otomatis melainkan dicatat sebagai flag informatif untuk konfirmasi kualitatif.
2. **SDG 9: Industry, Innovation, and Infrastructure (Target 9.4 - Efisiensi Komputasi & Ramah Energi):**
   - _Indikator Target:_ Efisiensi komputasi token melalui _Single-Pass Structured Extraction_ via gateway teroptimasi dibanding pendekatan multi-turn konvensional.
   - _Implementasi:_ Eksekusi _What-If Policy Simulator_ berjalan 100% in-memory lokal tanpa memanggil ulang API LLM.

---

## 4. ANALISIS PASAR, KOMPETITOR & MODEL BISNIS

### 4.1 Target Pengguna di Indonesia

1. **Fast-Growing Tech Startups (Series A-C):** Mengelola 200–500 pelamar teknik bulanan dengan tim HR ramping.
2. **Software Houses & Digital Agencies:** Memerlukan validasi cepat terhadap portofolio teknis dan kesesuaian proyek klien.
3. **Divisi Digital BUMN & Korporasi Finansial:** Wajib patuh UU PDP 2022, membutuhkan rekam jejak audit (_tamper-evident_) dan hak hapus data terjamin.

### 4.2 Analisis Kompetitor & Matriks Diferensiasi

| Parameter Evaluasi                 | ATS Konvensional (Greenhouse, Lever) | AI Screening Black-Box (HireVue)      | ATS Domestik (Talenta Mekari) | **TalentOps AI (Solusi Diusulkan)**                                       |
| ---------------------------------- | ------------------------------------ | ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| **Metode Penilaian**               | Pencocokan kata kunci statis         | Prediksi model probabilistik tertutup | Formulir administratif manual | **4D Deterministic Coverage & Taxonomy Engine** `[MVP]`                   |
| **Arsitektur LLM**                 | Tidak ada                            | Proprietary model terkunci            | Tidak ada                     | **Adaptive Model Adapter (9router + Gemini 3.8)** `[MVP]`                 |
| **Ketertelusuran Bukti**           | Tidak ada                            | Sangat rendah                         | Tidak ada                     | **Tinggi (Node-Edge Graph via React Flow)** `[MVP]`                       |
| **Deteksi Anomali Karier**         | Tidak ada                            | Terbatas pada sentimen teks           | Tidak ada                     | **Otomatis (Timeline Overlap & Title Inflation)** `[MVP]`                 |
| **Deteksi Prompt Injection**       | Tidak ada                            | Rentan terhadap teks tersembunyi      | Tidak ada                     | **Multi-layer (Hidden-text PDF/DOCX + Security Quarantine)** `[MVP]`      |
| **Integrasi Kalender**             | Standar link                         | Tautan manual                         | Penjadwalan manual            | **Atomic Lock + Event ID Idempotency + Compensating Transaction** `[MVP]` |
| **Kepatuhan Privasi (UU PDP)**     | Server US / GDPR                     | Isu persetujuan biometrik             | Database standar              | **AES-256-GCM + Blind Index Shredding + Audit Trail Non-Delete** `[MVP]`  |
| **Kendali Keputusan Akhir**        | Manual sepenuhnya                    | Otomatisasi tanpa supervisi           | Manual sepenuhnya             | **Human-in-the-Loop (HITL) Gatekeeper Wajib** `[MVP]`                     |
| **Simulasi Kebijakan ("What-If")** | Tidak tersedia                       | Tidak tersedia                        | Tidak tersedia                | **In-Memory Policy Simulation Studio (Zero LLM Re-call)** `[MVP]`         |

### 4.3 Model Bisnis, Unit Economics & Analisis Break-Even (B2B SaaS)

- **Unit Cost Variabel per Evaluasi Resume (Dihitung dari Tarif API Resmi Model Produksi):**
  - Token LLM (Gemini 3.8 Class via API resmi: Input ~3.500 token, Output + Thinking ~800 token): $\approx \text{Rp } 45 - \text{Rp } 55$ per berkas.
  - Komputasi Ingestion, Sanitasi & Bandwidth: $\approx \text{Rp } 15 - \text{Rp } 20$ per berkas.
  - Total Biaya Variabel per resume (COGS): $\approx \text{Rp } 60 - \text{Rp } 75$. Margin kotor operasional $\ge 85\%$.
- **Alokasi Biaya Tetap Infrastruktur Bulanan (Target Arsitektur Enterprise `[TARGET]`):**
  - Dedicated KMS / Vault Cluster: Rp 1.500.000 / bulan.
  - High Availability Database (MariaDB Multi-Node Replication + Redis Cluster): Rp 3.000.000 / bulan.
  - Compute Cluster (3 Worker Nodes + 2 API Nodes): Rp 2.500.000 / bulan.
  - **Total Biaya Tetap Operasional:** Rp 7.000.000 / bulan.
- **Analisis Titik Impas (Break-Even Point / BEP):**
  - Dengan paket langganan Starter (Rp 1.500.000 / bulan dengan alokasi kuota 500 berkas; COGS variabel = $500 \times \text{Rp } 75 = \text{Rp } 37.500$), kontribusi margin per pelanggan adalah $\text{Rp } 1.462.500$ / bulan.
  - $\text{BEP Pelanggan} = \frac{\text{Rp } 7.000.000}{\text{Rp } 1.462.500} \approx \mathbf{4.78} \rightarrow \mathbf{5 \text{ Pelanggan Aktif Paket Starter}}$.
- **Tingkatan Paket Layanan (Multi-Tenant Tiered Pricing `[TARGET]`):**
  - **Tier 1: Starter (Rp 1.500.000 / bulan):** Kuota 500 berkas/bln, 3 lowongan aktif, sanitasi PII dasar.
  - **Tier 2: Scale (Rp 4.500.000 / bulan):** Kuota 2.500 berkas/bln, lowongan tak terbatas, Google Calendar Two-Way Sync, React Flow Evidence Graph, What-If Simulator.
  - **Tier 3: Enterprise & BUMN Compliance (Custom SLA):** Kuota volume besar, Data at Rest di Indonesia (Jakarta Region), Dedicated KMS DEK Isolation, SSO SAML/OAuth2, target availability SLA 99.5%.

---

## 5. REKAYASA SISTEM: MODEL ADAPTER, DETERMINISTIC SCORING & DECISION POINTS

### 5.1 Arsitektur Model Adapter Layer & Pemisahan Peran Backend

Untuk melindungi sistem dari _deprecation lifecycle_ model komersial tertutup, TalentOps AI menerapkan **Adaptive Model Adapter Layer**:

- **Interface Standar OpenAI-Compatible:** Backend mengonsumsi LLM melalui client standar asinkronus (`AsyncOpenAI` SDK / `httpx`) yang mengarah ke gateway 9router dengan konfigurasi dinamis melalui environment variables:
  - `LLM_ROUTER_BASE_URL`: Endpoint gateway 9router.
  - `LLM_ROUTER_PROVIDER`: `antigravity` (orchestration provider).
  - `LLM_MODEL_NAME`: `gemini-3.8` (default target).
  - `LLM_FALLBACK_MODEL`: Cadangan otomatis jika target utama throttling.
  - `LLM_TEMPERATURE`: `0.0` (memaksimalkan stabilitas deterministik).
  - `LLM_THINKING_LEVEL`: `low` (ekstraksi fakta terstruktur tidak memerlukan penalaran panjang, menghemat latensi).
- **Mode Demo Aman (Safe Pre-Cached Mode `[MVP]`):**
  - Sistem menyediakan cache instan berbasis `file_hash` untuk 4 berkas resume demo standar.
  - Jika koneksi gateway eksternal mengalami kendala jaringan saat pengujian penjurian, sistem otomatis menggunakan hasil ekstraksi yang telah ter-cache dan menampilkan label status `[PRE-CACHED]` pada antarmuka untuk transparansi penuh.
- **Ekstraksi Terstruktur (Structured Extraction Engine):**
  LLM bertindak murni sebagai _Information Extractor_ dan sintesis skenario asesmen adaptif. LLM hanya menerima teks resume yang telah disanitasi dan dibungkus delimiter aman, mengekstrak data ke dalam skema JSON terstruktur:

  ```json
  {
    "claims": [
      {
        "dimension": "SKILL",
        "technology": "FastAPI",
        "has_implementation_detail": true,
        "context_narrative": "built async rest microservices handling 2k rps",
        "metric_string": "reduced latency by 40%",
        "repo_url": "https://github.com/candidate/payment-service",
        "source_location": "CV Page 2"
      }
    ],
    "career_timeline": [
      {
        "role": "Backend Engineer",
        "company": "[COMPANY_A]",
        "is_relevant_role": true,
        "employment_type": "full_time",
        "start": "2022-05",
        "end": "2024-06"
      },
      {
        "role": "Lead Architect",
        "company": "[COMPANY_B]",
        "is_relevant_role": true,
        "employment_type": "full_time",
        "start": "2023-01",
        "end": "present"
      }
    ],
    "education": {
      "degree": "S1",
      "field_of_study": "Informatika",
      "graduation_status": "Lulus"
    }
  }
  ```

  _(Catatan Keadilan: Field `accreditation` dan nama institusi dilarang dalam skema ekstraksi guna mencegah bias prestise almamater. Nilai `has_implementation_detail` diekstraksi LLM dan divalidasi oleh Substring Guard: jika klaim narasi tidak terverifikasi ada di dalam teks CV tersanitasi, field otomatis diturunkan ke `false`)_.

- **Deterministic Backend Engine (Python 3.12 Core):**
  - **Verifikasi Integritas Teks (Anti-Hallucination Substring Guard):** `context_narrative` dan `metric_string` divalidasi terhadap **teks resume yang telah disanitasi (teks yang dikirim ke LLM)** dengan normalisasi spasi (_whitespace collapsing_) dan _lowercase_. Klaim yang gagal dicocokkan otomatis diturunkan ke Tier 1.
  - **Pencegahan Double-Counting Portofolio & Skill:** Jika URL repositori GitHub telah digunakan untuk menaikkan klaim SKILL ke Tier 3, repositori tersebut pada dimensi PORTFOLIO dievaluasi hanya berdasarkan metrik repositori (star, struktur modular, branch cleanliness), bukan menambah poin skill kembali.
  - **Aturan Penjenjangan Bukti (Tiering Rubric):**
    - **SKILL:**
      - _Tier 1 (Dasar = 20.00):_ Hanya menyebutkan istilah skill/keyword tanpa penjelasan implementasi nyata (`has_implementation_detail: false`).
      - _Tier 2 (Kontekstual = 60.00):_ Memuat narasi implementasi nyata yang menggabungkan kata kerja aksi dan objek/tugas teknis (`has_implementation_detail: true`).
      - _Tier 3 (Terverifikasi = 100.00):_ Memenuhi Tier 2 **DAN** salah satu kondisi berikut:
        1. `metric_string` cocok dengan regex pola metrik:
           ```regex
           (?i)(?<![\w.])(?:\d+(?:[.,]\d+)?\s?(?:%|x|ms|sec|detik|rps|qps|tps|req/s|users?|pengguna|k|jt|juta)(?![a-z0-9])|(?:rp|\$)\s?\d[\d.,]*)
           ```
           **DAN** kalimat klaim memuat minimal satu kata konteks performa/bisnis (_latency, throughput, waktu, biaya, error, uptime, availability, user, beban, request, query, performa, akurasi, memory, cpu_) untuk menolak frasa basa-basi (_fluff_ seperti _"100% dedicated to quality"_).
        2. Repositori GitHub publik terverifikasi via GitHub API (menggunakan `GITHUB_TOKEN` server-side), bukan fork/mirror liar, serta bahasa utama (_primary language_) atau topics repositori selaras dengan teknologi yang diklaim.
    - **EXPERIENCE:**
      - _Tier 1 (Dasar = 20.00):_ Akumulasi durasi relevan $< 1$ tahun atau tanpa konteks tanggung jawab terinci.
      - _Tier 2 (Kompeten = 60.00):_ Akumulasi durasi relevan 1–3 tahun pada peran terkait dengan uraian tanggung jawab jelas.
      - _Tier 3 (Mahir = 100.00):_ Akumulasi durasi relevan $> 3$ tahun pada peran setara mid/senior dengan rekam jejak konsisten tanpa anomali.
    - **EDUCATION:**
      - _Tier 1 (20.00):_ Pendidikan non-linier tanpa korelasi terhadap domain lowongan.
      - _Tier 2 (60.00):_ Jenjang D3/S1 dalam rumpun ilmu komputer / teknologi relevan (Informatika, SI, Teknik Komputer, RPL).
      - _Tier 3 (100.00):_ Jenjang S2/S3 dalam rumpun ilmu relevan ATAU jenjang S1 dengan spesialisasi tugas akhir / sertifikasi profesi mendalam yang relevan dengan peran lowongan (tanpa memandang akreditasi institusi).
    - **PORTFOLIO:**
      - *Tier 1 (20.00):* Link portofolio tidak aktif atau repositori tidak dapat diakses.
      - *Tier 2 (60.00):* Repositori GitHub/link demo aktif dan relevan peran teknis.
      - *Tier 3 (100.00):* Repositori aktif dengan histori commit konsisten, struktur modular, dan author commit sesuai profil publik URL pelamar.
      - *(Catatan Penanganan Peran Non-Programmer):* Verifikasi GitHub REST API hanya diterapkan pada peran rekayasa perangkat lunak / IT development. Untuk lowongan non-programmer (misal: UI/UX, Product Management, Digital Marketing), tahapan audit GitHub dilewati (*bypassed*) tanpa penalti skor portofolio, dan penilaian portofolio dialihkan ke verifikasi tautan dokumen/demo serta pendalaman studi kasus pada asesmen adaptif (Siklus 5).

### 5.2 Formula Matematis Skor 4D, Keyakinan, & Risiko

1. **Kalkulasi Dimensi SKILL Berbasis Coverage Kompetensi Wajib:**
   Lowongan mendefinisikan daftar $M$ kompetensi wajib (_core_competencies_).
   $$SkillScore = \frac{\sum_{k=1}^{M} MatchScore(k)}{M} \times 100$$
   Di mana untuk setiap kompetensi $k$:
   - Jika kompetensi $k$ tidak ditemukan pada klaim kandidat: $MatchScore(k) = 0.0$.
   - Jika ditemukan: $MatchScore(k) = \max_{i \in Claims(k)} \left( \frac{TierScore_i}{100.0} \times Relevance_{i,k} \right)$.
   - $Relevance_{i,k}$ dihitung berdasarkan tabel taksonomi sistem (`SKILL_TAXONOMY_MAP`):
     - $1.0$: _Exact match_ teknologi (misal FastAPI == FastAPI).
     - $0.7$: _Ecosystem match_ / sinonim ekuivalen (misal FastAPI $\approx$ Django / Flask / Express.js; PostgreSQL $\approx$ MariaDB).
     - $0.0$: _Irrelevant_.

2. **Kalkulasi Dimensi Non-Skill ($DimScore_d$):**
   - **EXPERIENCE (Dengan Penggabungan Interval Overlap & Penjenjangan):**
     Sebelum perhitungan, seluruh rentang waktu kerja dievaluasi menggunakan algoritma _Interval Merging_. Jika terdapat dua posisi yang berjalan bersamaan (overlap), durasi yang tumpang tindih digabungkan menjadi satu kesatuan rentang waktu tunggal untuk mencegah manipulasi perhitungan ganda. $MergedYears$ didefinisikan secara tegas sebagai akumulasi tahun pengalaman pada peran teknis yang relevan dengan domain lowongan (_relevant engineering roles only_, peran non-relevan dikecualikan dari agregasi):
     $$
     DimScore_{EXP} = \begin{cases}
     20.0, & \text{jika } MergedYears < 1.0 \\
     20.0 + \left(\frac{MergedYears - 1.0}{2.0}\right) \times 40.0, & \text{jika } 1.0 \le MergedYears \le 3.0 \\
     \min\left(100.0, \, 60.0 + \left(\frac{MergedYears - 3.0}{2.0}\right) \times 40.0\right), & \text{jika } MergedYears > 3.0
     \end{cases}
     $$
     _(Catatan: MergedYears = 3.0 menghasilkan 60.0 [Tier 2 puncak], MergedYears $\ge 5.0$ menghasilkan 100.0 [Tier 3 penuh])._
   - **EDUCATION:** Ditentukan oleh capaian jenjang tertinggi yang relevan secara skalar (Tier 1 = 20, Tier 2 = 60, Tier 3 = 100).
   - **PORTFOLIO (Evaluasi Top Repositori / Non-Average Penalty):**
     Untuk mencegah satu repositori unggulan terseret turun oleh repositori eksperimen kecil, skor portofolio mengambil nilai maksimal dari repositori terverifikasi:
     $$DimScore_{PORT} = \max_{m \in ValidRepos} (TierScore_m) \quad (\text{jika } |ValidRepos| > 0, \text{ selainnya } 0.0)$$

3. **Skor Total Akhir ($OverallScore$):**
   $$OverallScore = \sum_{d \in \{SKILL, EXPERIENCE, EDUCATION, PORTFOLIO\}} (DimScore_d \times w_d)$$
   _Constraint:_ $\sum w_d = 1.0$ (divalidasi ketat oleh skema Pydantic v2).

4. **Penetapan Tingkat Keyakinan (_Confidence Level_):**
   - `HIGH`: $\ge 80\%$ klaim teknis berada di Tier 2 atau Tier 3, serta kronologi kerja valid.
   - `MEDIUM`: $50\% - 79\%$ klaim teknis berada di Tier 2 atau Tier 3.
   - `LOW`: $< 50\%$ klaim teknis berada di Tier 2 atau Tier 3.

5. **Penetapan Risiko (_Unresolved Risk_):**
   - `HIGH`:
     - Terdeteksi _indirect prompt injection_ atau manipulasi teks tersembunyi (_Security Quarantine_).
     - Tumpang tindih tanggal kerja $> 3$ bulan pada dua posisi purnawaktu (_full-time concurrent roles_).
   - `MEDIUM`:
     - Terdapat anomali penulisan jabatan (_title inflation_, misal dari Magang langsung Chief Architect dalam durasi $< 6$ bulan).
   - `LOW`: Tidak ada anomali terdeteksi.
   - _Kebijakan Khusus Career Break:_ Kesenjangan karier $> 12$ bulan diberi label informatif `CAREER_BREAK_FLAG` tanpa otomatis menaikkan status menjadi `Risk MEDIUM`, menjaga agar kandidat dengan cuti keluarga/asuh tetap berpeluang memperoleh status `STRONG_MATCH`.

6. **Matriks Rekomendasi Hierarkis Tegas & Prioritas Triage:**
   - **Aturan 0 (Security Quarantine):** Jika terdeteksi _Prompt Injection / Hidden Text_, status **WAJIB** = `REVIEW_REQUIRED` dengan flag risiko `HIGH` dan prioritas `HIGH_ATTENTION` (dilarang auto-archive demi investigasi compliance).
   - **Aturan 1 (Kandidat Unggul):** Jika $OverallScore \ge 85.0$ DAN $Confidence == HIGH$ DAN $Risk == LOW$, maka status = `STRONG_MATCH`, prioritas `STANDARD`.
   - **Aturan 2 (Wajib Verifikasi Human / Ambang Kritis):** Jika $OverallScore \ge 60.0$ DAN ($Risk \in \{HIGH, MEDIUM\}$ ATAU $Confidence == LOW$), maka status = `REVIEW_REQUIRED` dengan prioritas `HIGH_ATTENTION` (memerlukan investigasi anomali/gap kompetensi sebelum keputusan).
   - **Aturan 3 (Kandidat Kompeten Standard):** Jika $OverallScore \ge 60.0$ DAN $Risk == LOW$ DAN $Confidence \in \{HIGH, MEDIUM\}$, maka status = `REVIEW_REQUIRED` dengan prioritas `STANDARD` (siap dijadwalkan wawancara rutin).
   - **Aturan 4 (Eliminasi Kelayakan):** Jika $OverallScore < 60.0$, maka status = `WEAK_FIT` (dimasukkan ke antrean rekomendasi penolakan yang membutuhkan konfirmasi batch satu klik HR).

---

### 5.3 Tabel Titik Keputusan Agen (Agent Decision Points)

| Siklus Agen                   | Keputusan Otonom Agen                              | Opsi Tindakan yang Tersedia                                   | Guardrails & Batasan Otonomi                                              | Mekanisme Fallback Jika Gagal                                 |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **1. Dokumen Ingestion**      | Memvalidasi integritas berkas & mengekstraksi teks | Parsing PDF/DOCX, deteksi font 0pt, alpha channel, `w:vanish` | Tolak payload $> 10\text{ MB}$, hapus teks mencurigakan, log anomali      | Tandai `INSPECTION_FAILED`, eskalasi ke manual review         |
| **2. Ekstraksi Informasi**    | Mengelompokkan riwayat ke skema terstruktur        | Panggilan via Model Adapter Layer (9router / Gemini 3.8)      | Suhu 0.0, output skema Pydantic tertutup, dilarang beri skor numerik      | Gunakan Safe Pre-Cached Mode atau fallback model              |
| **3. Audit Substring**        | Memverifikasi fakta klaim terhadap teks asli       | Validasi verbatim teks tersanitasi                            | Menolak halusinasi; jika substring tidak cocok, turunkan ke Tier 1        | Fallback ke Tier 1 (klaim dasar)                              |
| **4. Investigasi Portofolio** | Menentukan kebutuhan verifikasi repositori | Panggil GitHub REST API jika URL repositori valid (khusus role programmer/IT) | Timeout 2.5s, SSRF guard (hanya `api.github.com`), verifikasi bahasa repo; lewati otomatis untuk role non-programmer | Lewati verifikasi eksternal, beri flag `PORTFOLIO_UNVERIFIED` (atau `NOT_APPLICABLE` untuk non-dev) |
| **5. Sintesis Asesmen**       | Memutuskan perlunya soal teknis adaptif            | Generate 1-2 soal teknis terarah jika gap skill kritis        | Hanya dipicu jika kompetensi kunci memiliki keyakinan rendah              | Gunakan bank soal standar lowongan terkait                    |
| **6. Penjadwalan Kalender**   | Memilih slot wawancara tentative                   | Kunci slot kalender pewawancara via atomic lock DB            | Non-overlapping constraint, client-generated event ID                     | Transaksi kompensasi (lepas slot), coba slot berikutnya       |
| **7. Gatekeeper HITL**        | Menghentikan eksekusi sebelum tindakan berdampak   | Tahan status hingga persetujuan HR diterima                   | Dilarang mengirim email dispatch atau unmask PII tanpa aksi HR            | Tetap dalam antrean `waiting_approval`                        |

_Keterangan untuk Penjurian GTNIC:_ Seluruh langkah keputusan agen, eksekusi tool, dan aktivasi guardrail disiarkan secara langsung melalui SSE Live Trace ke antarmuka pengguna, membuktikan bahwa sistem beroperasi sebagai agen cerdas dengan tata kelola (_governance_), bukan sekadar pipeline sekuensial statis.

---

### 5.4 Alokasi Anggaran Waktu Latensi (Latency Budget) & Throughput Batch

Target evaluasi end-to-end $\le 15.000\text{ ms}$ per berkas:

| Tahapan Pipeline                                      | Durasi p50   | Durasi p95    | Keterangan & Mekanisme Optimasi                                                                                          |
| ----------------------------------------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1. Ingestion, Hidden-Text Audit & PII Sanitizer       | 150 ms       | 280 ms        | Ekstraksi in-memory PDF/DOCX (pypdf/pdfplumber), High-Performance Regex Sanitizer (Nama, Kontak, Almamater)              |
| 2. Structured LLM Extraction (Gemini 3.8 via 9router) | 3.500 ms     | 5.200 ms      | Model Adapter via 9router (Antigravity), single-turn schema, file_hash cache (dinonaktifkan saat benchmark determinisme) |
| 3. GitHub API Portfolio Verification                  | 850 ms       | 2.100 ms      | Async REST ke api.github.com (timeout 2.5s, in-memory LRU cache)                                                         |
| 4. Deterministic 4D Scoring & Timeline Audit          | 45 ms        | 80 ms         | Perhitungan matematis lokal Python & taksonomi mapping                                                                   |
| 5. Adaptive Assessment Synthesis                      | 1.100 ms     | 2.200 ms      | Dipicu selektif jika terdeteksi gap kompetensi kunci                                                                     |
| 6. DB ACID Commit & SSE Event Broadcast               | 85 ms        | 150 ms        | aiomysql transaction pool + in-memory asyncio.Queue stream                                                               |
| **SUBTOTAL PIPELINE EVALUASI**                        | **5.730 ms** | **10.010 ms** | **Penyelesaian triage utama kandidat (Target Desain)**                                                                   |
| 7. External Integrations (Mock Calendar & Dispatch)\* | 650 ms       | 1.850 ms      | _Dijalankan async/non-blocking via background task_                                                                      |
| **TOTAL WAKTU END-TO-END SYSTEM**                     | **6.380 ms** | **11.860 ms** | **Memenuhi anggaran desain latensi $\le 15.000\text{ ms}$**                                                              |

---

## 6. ARSITEKTUR TEKNIS, KEAMANAN & KEPATUHAN HUKUM

### 6.1 Mitigasi Indirect Prompt Injection & Anti-Spoofing

1. **Tag Delimiter & Escaping:** Teks resume dibungkus tag XML `<candidate_resume_untrusted>`. Karakter penutup di-escape menjadi `&lt;/candidate_resume_untrusted&gt;`.
2. **Audit Hidden Text (PDF & DOCX):**
   - PDF: Memeriksa elemen dengan alpha channel 0, font size $\le 1\text{pt}$, atau teks berwarna serupa latar belakang (RGB #FFFFFF).
   - DOCX: Memeriksa tag XML `w:vanish`, `w:hidden`, teks di luar margin halaman, dan ukuran font minimalis. Seluruh teks tersembunyi dihapus dari proses evaluasi dan otomatis memicu pencatatan ke `candidate_anomalies` dengan flag risiko `HIGH`.
3. **Pencegahan Stored XSS & Aman Rendering:** Seluruh teks yang berasal dari resume maupun hasil ekstraksi LLM di-render pada UI sebagai teks murni (_plain text DOM node_ / sanitized markdown). Penggunaan `dangerouslySetInnerHTML` dilarang. Header HTTP Content Security Policy dikonfigurasi di sisi frontend edge (`vercel.json`) untuk lingkungan produksi:
   ```http
   Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.talentops.id;
   ```
   _(Catatan Lingkungan Dev: `connect-src` ditambahkan `http://127.0.0.1:8002` khusus pada profil pengembangan lokal)_.
4. **SSRF Guard pada Repo URL:** URL repositori diparsing ketat dengan regex format `^https:\/\/github\.com\/[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$`. Host selain `github.com` dan IP privat ditolak seketika. Pemanggilan GitHub REST API dilakukan murni oleh backend (bukan browser frontend).
5. **Proteksi Endpoint Ingestion Publik (`/api/careers/{id}/apply`) & Jalur Dropzone:**
   - _Rate Limiting Berbasis IP di Belakang Reverse Proxy:_ Maksimal 5 permintaan unggah per menit per client IP dengan parsing header `X-Forwarded-For` terverifikasi (IP terluar yang diteruskan Nginx). Rate limit ini tidak berlaku untuk pengguna HR terautentikasi di dashboard internal.
   - _Magic Bytes File Validation:_ Validasi header biner file fisik sebelum parsing (PDF wajib diawali bytes `%PDF-` / `\x25\x50\x44\x46`, DOCX wajib berstruktur ZIP `PK\x03\x04`). Ekstensi file yang tidak sesuai dengan magic bytes ditolak seketika (HTTP 415).
   - _Sanitasi PII Dua Arah (Two-Way Dictionary Matching):_ Untuk jalur `/apply`, data input form (Nama, Email, Nomor Telepon) secara otomatis dijadikan kamus pencocokan string eksplisit untuk membersihkan kemunculan identitas di dalam isi teks narasi CV sebelum dikirim ke LLM.
   - _Transparansi Batasan Jalur HR Dropzone & Integrasi Metadata Form (Opsi A):_ Pada modal upload HR (`UploadCandidateModal.jsx`), pengguna wajib menyertakan metadata pelamar (`applicant_meta: [{name, email}]`) selaras indeks berkas. Backend mengenkripsi identitas asli ke `encrypted_name` & `encrypted_email`, menghitung `email_blind_index` dari email asli, dan meneruskan nama/email ke modul sanitasi *two-way dictionary matching*. Jika berkas diunggah tanpa form metadata (legacy API caller), sistem menandai `identity_source = 'placeholder'` dengan mitigasi heuristik regex kontak atas.
6. **Penegakan Hak Akses Basis Data (Database Least Privilege) & Retensi Audit:**
   - _Status Implementasi (jujur):_ Klaim di atas adalah **rencana**, bukan kondisi terpasang. Repositori belum memiliki migrasi yang menjalankan `REVOKE` tersebut, dan user `willy@%` di VPS masih memegang `GRANT ALL ON *.* WITH GRANT OPTION`, sehingga pagar hak akses dapat dibuka kembali oleh siapa pun yang memakai kredensial itu. Yang benar-benar berlaku saat ini: tidak ada satu pun jalur kode aplikasi yang melakukan `UPDATE`/`DELETE` pada ketiga tabel tersebut (diverifikasi pada seluruh `backend/app/`), sehingga sifat append-only ditegakkan oleh konvensi kode, bukan oleh database engine. Endpoint `/api/audit/trail` sudah menyatakan hal ini secara terbuka pada field `compliance.retention_policy`. Untuk menaikkan ke penegakan fisik, tambahkan migrasi `004` berisi `REVOKE UPDATE, DELETE` pada ketiga tabel (setelah `SHOW GRANTS FOR 'talentops_app'@'localhost'`) atau, lebih kuat, trigger `BEFORE UPDATE`/`BEFORE DELETE` yang melakukan `SIGNAL SQLSTATE '45000'` — trigger tetap berlaku bahkan bagi user dengan hak penuh.
   - _Dasar Retensi Audit `consent_records`:_ Entri persetujuan tetap mempertahankan `masked_identifier`, IP address, dan timestamp bahkan setelah kandidat mengajukan hak hapus (_crypto-shredding_) atas identitas langsungnya. Hal ini merupakan kewajiban kepatuhan hukum pengendali data berdasarkan UU PDP untuk membuktikan bahwa pemrosesan terdahulu telah didasarkan pada persetujuan sah yang pernah diberikan.

### 6.2 Desain Kepatuhan UU PDP No. 27/2022 & Regulasi Ketenagakerjaan

1. **Kebijakan Data Demo vs Produksi:**
   - _Lingkungan Demo Publik `[MVP]`:_ Dikhususkan untuk data sintetis. Antarmuka memasang banner peringatan _"Gunakan data sintetis untuk pengujian live demo"_ pada seluruh shell dashboard admin (`/admin/*`). Background worker pembersih data demo 4 jam (_ephemeral demo storage_) disediakan secara modular namun secara default dinonaktifkan (`DEMO_PURGE_ENABLED = False`) guna menjaga integritas *golden dataset* 25 resume sintetis yang dijadikan acuan demonstrasi langsung dan penjurian kompetisi.
   - _Target Lingkungan Produksi `[TARGET]`:_ Menggunakan koneksi resmi Google Cloud Vertex AI Enterprise berlandaskan _Data Processing Addendum (DPA)_ dan _Standard Contractual Clauses (SCC)_ sesuai koridor regulasi transfer dan pemrosesan data pribadi UU PDP.
2. **Enkripsi Aplikasi, Blind Index, & Manajemen Kunci:**
   - Field identitas pribadi (`name`, `phone`) dienkripsi menggunakan **AES-256-GCM** dengan Data Encryption Key (DEK) unik per kandidat. DEK dilindungi oleh Master Key Encryption Key (KEK).
   - Pencarian email dan pencegahan duplikasi menggunakan **Blind Index** HMAC-SHA256 (`email_blind_index = HMAC(Candidate_Email, Secret_Pepper)`).
3. **Hak Hapus Data Berkelanjutan (_Right to Erasure / Crypto-Shredding_):**
   - Pemanggilan endpoint penghapusan menghancurkan DEK kandidat dari key store, membuat ciphertext identitas tidak dapat dipulihkan secara permanen.
   - Kolom `email_blind_index` ditimpa dengan nilai acak kriptografis (_tombstone hash_) untuk memutus pseudonimitas.
   - _Kebijakan Soft Deletion Kriptografis (Non-Physical Delete):_ Baris fisik pada tabel `candidates` tidak pernah dihapus dengan `DELETE FROM candidates` guna menjaga keutuhan referensi relasional database dan menghindari pemicuan `CASCADE`. Baris kandidat ditandai `is_deleted = TRUE` dengan seluruh data identitas ter-shredding.
   - Eksekusi pembersihan data relasional (berkas fisik PDF/DOCX, `sanitized_resume_text`, entri bukti `candidate_evidence`, soal asesmen `candidate_assessments`, catatan review `human_reviews.notes`, serta in-memory cache) dijalankan oleh modul service khusus (`talentops_erasure`). Modul ini hanya dapat dipicu oleh peran `compliance_officer` (dengan verifikasi alasan hukum) atau pemohon mandiri melalui `/careers/withdraw`. Setiap pemanggilan wajib mencatat jejak audit ke tabel `pii_access_logs` (reason: `RIGHT_TO_ERASURE_FULFILLED`) sebelum data dihancurkan.
   - Payload log audit pada `agent_steps` hanya mencatat metadata, ID kandidat, dan hash klaim (tanpa menyimpan kutipan teks narasi resume mentah) untuk menjamin pemenuhan hak hapus secara tuntas.
4. **Pembatasan Pembukaan Identitas (_Unmasking Governance_):**
   - Pembukaan identitas (unmask) **DILARANG** selama tahap blind review.
   - Unmask hanya dapat dieksekusi setelah kandidat memperoleh status keputusan `APPROVED_DISPATCH` (untuk persiapan wawancara) ATAU oleh peran `compliance_officer` untuk keperluan audit legal, dengan kewajiban input alasan yang dicatat ke `pii_access_logs`.

### 6.3 Sirkuit Bounded Self-Healing & Penegakan Non-Overlap Reservasi Kalender

1. **Google Calendar Idempotency via Client-Generated Event ID:**
   - Idempotensi dicapai dengan membuat **Client-Generated Event ID** deterministik saat pemanggilan `events.insert`:
     $$\text{eventId} = \text{base32hex\_clean}(\text{"talentops\_" + slot\_id + "\_" + candidate\_id})$$
     _(Format: huruf kecil base32 tanpa padding `=`, panjang 5–1024 karakter sesuai spesifikasi API Google Calendar)_.
   - Jika panggilan duplikat terjadi, API mengembalikan status 409 Conflict yang ditangani sistem secara elegan tanpa membuat duplikasi jadwal.
2. **Penegakan Non-Overlap & Anti Double-Booking Transaksional (ACID):**
   - Transaksi database MariaDB dijalankan dengan isolasi level `REPEATABLE READ` (default InnoDB engine). Untuk mencegah _race condition_ dan _deadlock_, sistem menerapkan **urutan penguncian transaksional baku (Strict Lock Hierarchy: `users` -> `interview_slots` -> `candidates`)**. Transaksi mengunci baris pewawancara terlebih dahulu (`SELECT id FROM users WHERE id = :interviewer_id FOR UPDATE`), sehingga seluruh proses pengecekan dan reservasi slot untuk pewawancara yang sama berjalan secara serial:

     ```sql
     -- 1. Serialkan transaksi untuk pewawancara terkait
     SELECT id FROM users WHERE id = :interviewer_id FOR UPDATE;

     -- 2. Kunci slot target (jika memilih slot existing)
     SELECT id FROM interview_slots WHERE id = :slot_id FOR UPDATE;

     -- 3. Periksa benturan interval waktu terhadap seluruh slot milik pewawancara
     SELECT id FROM interview_slots
     WHERE interviewer_id = :interviewer_id
       AND status IN ('tentative', 'booked')
       AND start_time < :new_end_time
       AND end_time > :new_start_time
     FOR UPDATE;
     ```

   - Jika query benturan mengembalikan baris ($rowcount > 0$), transaksi langsung di-rollback sebelum status berubah menjadi `tentative`.
   - _Aturan Satu Kandidat Satu Slot Aktif:_ Ditegakkan melalui query transaksional aplikasi yang memeriksa kandidat tidak memiliki slot lain berstatus `tentative` atau `booked` (`SELECT id FROM interview_slots WHERE candidate_id = :candidate_id AND status IN ('tentative', 'booked') FOR UPDATE`).
   - _Job Pembersih Slot Kedaluwarsa (Cleaner Task):_ Background task periodik (setiap 5 menit) dan startup recovery task otomatis membebaskan slot `tentative` yang telah melewati batas kedaluwarsa (`UPDATE interview_slots SET status = 'available', tentative_expires_at = NULL, candidate_id = NULL WHERE status = 'tentative' AND tentative_expires_at < NOW()`).

3. **Pola Transaksi Kompensasi (Saga Pattern):**
   - Transaksi database mengunci slot menjadi `tentative` dengan TTL 60 menit (`lock_version = lock_version + 1`).
   - Panggilan eksternal ke kalender dieksekusi; jika gagal setelah retry backoff, sistem menjalankan **transaksi kompensasi**:
     ```sql
     UPDATE interview_slots
     SET status = 'available', tentative_expires_at = NULL, candidate_id = NULL
     WHERE id = :slot_id AND status = 'tentative';
     ```
     Jika event di kalender sempat terbuat sebagian, kompensasi mengeksekusi `events.delete(eventId)` untuk menjaga konsistensi.
4. **Tagging Lingkungan Demo / Sandbox:**
   - Antarmuka demo menampilkan banner tegas _"Gunakan data sintetis untuk pengujian live demo"_ (PRD §6.2), dan label **[MOCK / SANDBOX]** tetap ditampilkan pada panel kalender **hanya bila** kredensial Google Calendar belum diisi — begitu `GOOGLE_CLIENT_ID`/`SECRET` terpasang, label itu hilang dengan sendirinya karena adapter melaporkan status live. Pengujian konkurensi 50 transaksi reservasi simultan mencakup pengujian slot bergeser (_sliding interval overlap_) dan slot identik.

---

## 7. SKEMA BASIS DATA RELASIONAL (13 TABEL INTI LIVE DEMO MVP)

Skema 3NF MariaDB/InnoDB di bawah ini merupakan fondasi yang diimplementasikan pada **Live Demo MVP** (dengan _Single Default Tenant_ `tenant_id=1`). Skema ini dapat dikembangkan langsung ke 15 tabel multi-tenant penuh pada target arsitektur enterprise `[TARGET]`:

```sql
-- 1. Manajemen Pengguna & RBAC
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Argon2id
    role ENUM('admin', 'recruiter', 'hiring_manager', 'compliance_officer') NOT NULL,
    failed_logins INT DEFAULT 0,
    locked_until DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Kredensial Integrasi & OAuth
CREATE TABLE oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    provider ENUM('google_calendar', 'greenhouse', 'mock_calendar') NOT NULL,
    encrypted_access_token VARBINARY(512) NOT NULL,
    encrypted_refresh_token VARBINARY(512) NOT NULL,
    token_expiry DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Definisi Lowongan Kerja & Job Intelligence (Public Career Profile Extension)
CREATE TABLE job_descriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,           -- Recruiter / Admin pemilik lowongan
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    raw_text LONGTEXT NOT NULL,
    core_competencies JSON NOT NULL, -- ["FastAPI", "Docker", "PostgreSQL", "CI/CD", "Redis"]
    flagged_ambiguities JSON NULL,   -- Feedback audit bias deskripsi lowongan
    weight_config JSON NOT NULL,     -- {"SKILL": 0.4, "EXPERIENCE": 0.3, "EDUCATION": 0.1, "PORTFOLIO": 0.2}
    status ENUM('active', 'closed') DEFAULT 'active',
    company_name VARCHAR(150) NULL,  -- Profil publik portal karir (Migrasi 005)
    company_logo_url VARCHAR(255) NULL,
    company_about TEXT NULL,
    company_address VARCHAR(255) NULL,
    company_industry VARCHAR(100) NULL,
    company_website VARCHAR(255) NULL,
    job_function VARCHAR(100) NULL,
    employment_level VARCHAR(50) NULL,
    location VARCHAR(150) NULL,
    deadline DATE NULL,
    description_text LONGTEXT NULL,
    requirements_text LONGTEXT NULL,
    is_tech_role TINYINT(1) NOT NULL DEFAULT 1, -- Klasifikasi posisi: 1 = IT/Engineering, 0 = Non-IT (Migrasi 007)
    competency_taxonomies JSON NULL,           -- Kamus sinonim & ekosistem dinamis per kompetensi (Migrasi 007)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Data Master Kandidat (Crypto-Shredding & Optimistic Locking)
CREATE TABLE candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    encrypted_name VARBINARY(255) NOT NULL, -- AES-256-GCM via candidate DEK
    encrypted_email VARBINARY(255) NOT NULL, -- AES-256-GCM via candidate DEK (untuk notifikasi izin)
    encrypted_phone VARBINARY(255) NULL,    -- AES-256-GCM via candidate DEK
    encrypted_dek VARBINARY(255) NOT NULL,  -- Data Encryption Key unik terenkripsi Master KEK
    email_blind_index CHAR(64) NULL,        -- Di-overwrite acak saat Right to Erasure
    masked_identifier VARCHAR(64) UNIQUE NOT NULL, -- Display public ID: Format #TK-[6-HEX] (16.7M variasi + retry logic)
    masked_name_hint VARCHAR(128) NULL,     -- Inisial nama tersamar (misal B**i S*****o) untuk blind review dossier (Migrasi 004)
    tracking_token CHAR(64) UNIQUE NOT NULL,       -- Token rahasia berentropi tinggi untuk tracking pelamar
    resume_file_path VARCHAR(255) NULL,
    file_hash_sha256 CHAR(64) NULL,         -- Di-nullkan saat Right to Erasure
    github_url VARCHAR(255) NULL,           -- Input opsional pelamar / hasil ekstraksi
    portfolio_url VARCHAR(255) NULL,        -- Input opsional link portofolio
    sanitized_resume_text LONGTEXT NULL,
    dimension_scores JSON NULL,
    overall_score DECIMAL(5,2) NULL,        -- NULL selama queued/analyzing
    confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') NULL,
    unresolved_risk ENUM('LOW', 'MEDIUM', 'HIGH') NULL,
    recommendation ENUM('STRONG_MATCH', 'REVIEW_REQUIRED', 'WEAK_FIT') NULL,
    triage_priority ENUM('HIGH_ATTENTION', 'STANDARD') DEFAULT 'STANDARD',
    status ENUM('queued', 'analyzing', 'waiting_approval', 'approved', 'rejected', 'request_info', 'failed') DEFAULT 'queued',
    is_deleted BOOLEAN DEFAULT FALSE,
    version INT DEFAULT 1,                  -- Optimistic Locking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_candidate_job (job_id),
    INDEX idx_candidate_status (status),
    INDEX idx_candidate_recommendation (recommendation),
    INDEX idx_candidate_blind_email (email_blind_index),
    INDEX idx_candidate_tracking (tracking_token),
    FOREIGN KEY (job_id) REFERENCES job_descriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Rekam Jejak Persetujuan Pemrosesan Data (UU PDP)
CREATE TABLE consent_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NULL,
    masked_identifier VARCHAR(64) NOT NULL,
    consent_source ENUM('direct_applicant', 'recruiter_legitimate_interest') NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT TRUE,
    consent_hash CHAR(64) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bukti Rekomendasi (Evidence-Based Graph Data)
CREATE TABLE candidate_evidence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    dimension ENUM('SKILL', 'EXPERIENCE', 'EDUCATION', 'PORTFOLIO') NOT NULL,
    target_competency VARCHAR(100) NULL,
    claim_text TEXT NOT NULL,
    evidence_source TEXT NOT NULL,
    score_contribution DECIMAL(5,2) NOT NULL,
    confidence DECIMAL(3,2) NOT NULL, -- 1.00 (Tier 3), 0.75 (Tier 2), 0.50 (Tier 1)
    matched_requirement VARCHAR(100) NULL, -- Target kompetensi lowongan yang dipenuhi (Migrasi 003)
    verified TINYINT(1) NOT NULL DEFAULT 0, -- 1 bila narasi terverifikasi lolos Substring Guard ke teks CV (Migrasi 003)
    INDEX idx_evidence_cand (candidate_id),
    INDEX idx_evidence_cand_verified (candidate_id, verified),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Anomali & Risiko Investigasi Karier
CREATE TABLE candidate_anomalies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    anomaly_type VARCHAR(100) NOT NULL, -- 'PROMPT_INJECTION', 'OVERLAPPING_DATES', 'TITLE_INFLATION'
    severity ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
    description TEXT NOT NULL,
    suggested_verification TEXT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Soal Asesmen Teknis Adaptif (Gap-based Challenge)
CREATE TABLE candidate_assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    target_skill VARCHAR(100) NOT NULL,
    difficulty_level ENUM('L1_FUNDAMENTAL', 'L2_SYSTEM_DESIGN', 'L3_EDGE_CASE') NOT NULL,
    scenario_question TEXT NOT NULL,
    evaluation_criteria TEXT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Slot Jadwal Wawancara (Atomic Lock & Anti Double-Booking)
CREATE TABLE interview_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NULL,
    interviewer_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('available', 'tentative', 'booked') DEFAULT 'available',
    external_calendar_event_id VARCHAR(150) NULL,
    lock_version INT DEFAULT 0,
    tentative_expires_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_interviewer_slot (interviewer_id, start_time),
    INDEX idx_candidate_slots (candidate_id),
    INDEX idx_slot_status_time (status, start_time),
    FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Audit Trail Langkah Siklus Agen (Append-Only)
CREATE TABLE agent_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    candidate_id INT NULL,
    masked_identifier VARCHAR(64) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    model_id VARCHAR(50) NULL,
    thinking_level VARCHAR(20) NULL,
    status ENUM('started', 'completed', 'failed', 'recovered') NOT NULL,
    payload_input JSON NULL,   -- Hanya menyimpan ID/Hash/Metrik (bukan raw teks resume)
    payload_output JSON NULL,
    error_message TEXT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_run_candidate (run_id, candidate_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Persetujuan Manusia (HITL Decision Records)
CREATE TABLE human_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    decision ENUM('APPROVED_DISPATCH', 'REQUEST_INFO', 'OVERRIDE_REJECT', 'REJECT_CONFIRMED') NOT NULL,
    notes TEXT NULL,
    version INT DEFAULT 1,                  -- Optimistic Locking
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Log Akses PII (Unmasking Audit - Append-Only)
CREATE TABLE pii_access_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    candidate_id INT NULL,
    masked_identifier VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pii_user (user_id),
    INDEX idx_pii_cand (candidate_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Blog & Artikel Inspirasi Ekosistem (Public Blog & Admin CMS - Migrasi 006)
CREATE TABLE blog_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    summary TEXT NOT NULL,
    content LONGTEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    author_name VARCHAR(100) DEFAULT 'Admin TalentOps',
    cover_image_url VARCHAR(500) NULL,
    read_time_minutes INT DEFAULT 3,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_blog_slug (slug),
    INDEX idx_blog_category (category),
    INDEX idx_blog_published_created (is_published, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 8. SPESIFIKASI REST API, EVIDENCE GRAPH & SIMULASI WHAT-IF

### 8.1 Matriks Otorisasi RBAC

| Endpoint                              | Method    | Publik |      Admin      |       Recruiter        |   Hiring Manager    | Compliance Officer |
| ------------------------------------- | --------- | :----: | :-------------: | :--------------------: | :-----------------: | :----------------: |
| `/api/careers`                        | GET       |   Ya   |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/careers/{id}`                   | GET       |   Ya   |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/careers/{id}/apply`             | POST      |   Ya   |       Ya        |           Ya           |        Tidak        |       Tidak        |
| `/api/careers/track/{tracking_token}` | GET       |   Ya   |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/careers/withdraw`               | POST      |   Ya   |       Ya        |           Ya           |        Tidak        |       Tidak        |
| `/api/auth/login`                     | POST      |   Ya   |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/jobs`                           | POST/GET  | Tidak  |       Ya        |           Ya           |         Ya          |     Baca Saja      |
| `/api/jobs/{id}/analyze-bias`         | POST      | Tidak  |       Ya        |           Ya           |         Ya          |     Baca Saja      |
| `/api/jobs/{id}/simulate-policy`      | POST      | Tidak  |       Ya        |           Ya           |         Ya          |     Baca Saja      |
| `/api/candidates`                     | GET       | Tidak  |       Ya        |           Ya           |         Ya          |  Terbatas Masked   |
| `/api/candidates/upload`              | POST      | Tidak  |       Ya        |           Ya           |        Tidak        |       Tidak        |
| `/api/candidates/{id}/triage`         | POST      | Tidak  |       Ya        |           Ya           |         Ya          |       Tidak        |
| `/api/candidates/batch-triage`        | POST      | Tidak  |       Ya        |           Ya           |         Ya          |       Tidak        |
| `/api/candidates/{id}`                | GET       | Tidak  |     Masked      |         Masked         |       Masked        |       Masked       |
| `/api/candidates/{id}/evidence-graph` | GET       | Tidak  |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/candidates/{id}/unmask`         | POST      | Tidak  |   Audit Only    |  Hanya Pasca-Approve   | Hanya Pasca-Approve |  Otorisasi Audit   |
| `/api/candidates/{id}/review`         | POST      | Tidak  |       Ya        |           Ya           |         Ya          |       Tidak        |
| `/api/candidates/{id}`                | DELETE    | Tidak  | Otorisasi Penuh |       Permohonan       |        Tidak        |  Otorisasi Penuh   |
| `/api/slots`                          | GET       | Tidak  |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/slots/available`                | GET       | Tidak  |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/slots/reserve`                  | POST      | Tidak  |       Ya        |           Ya           |         Ya          |       Tidak        |
| `/api/blog`                           | GET       |   Ya   |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/blog/{slug}`                    | GET       |   Ya   |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/blog`                           | POST      | Tidak  |       Ya        |        Tidak           |        Tidak        |       Tidak        |
| `/api/blog/{id}`                      | PUT/DELETE| Tidak  |       Ya        |        Tidak           |        Tidak        |       Tidak        |
| `/api/candidates/{id}/sse-ticket`     | POST      | Tidak  |       Ya        |           Ya           |         Ya          |         Ya         |
| `/api/candidates/{id}/trace-stream`   | GET (SSE) | Ticket |     Ticket      |         Ticket         |       Ticket        |       Ticket       |
| `/api/audit-trail`                    | GET       | Tidak  |      Penuh      | Milik Lowongan Sendiri |        Tidak        |       Penuh        |

### 8.2 Spesifikasi Detail Endpoint Utama

1. **`GET /api/careers` & `GET /api/careers/{id}`**: Endpoint publik untuk melihat daftar dan rincian lowongan kerja aktif tanpa autentikasi (mendukung rincian profil perusahaan, logo, jenjang, fungsi, lokasi, batas waktu lamaran, dan persyaratan lowongan).
2. **`POST /api/careers/{id}/apply`**: Endpoint pelamar mandiri dengan rate limiting (5 req/menit), validasi magic bytes (PDF/DOCX), dan two-way PII dictionary sanitization. Mengembalikan `masked_identifier` (misal `#TK-A17C9B`) untuk display serta `tracking_token` rahasia (UUIDv4/nanoid) untuk akses pelacakan.
3. **`GET /api/careers/track/{tracking_token}`**: Endpoint publik untuk pelamar memantau status seleksi anonim (`queued`, `analyzing`, `waiting_approval`, `approved`, `rejected`) secara aman tanpa risiko enumerasi ID.
4. **`POST /api/careers/withdraw` & `DELETE /api/candidates/{id}`**: Kedua endpoint ini sama-sama mengeksekusi service terpadu `talentops_erasure`. Menghancurkan DEK kandidat, menimpa hash blind index, membersihkan relasi terkait, dan menandai `is_deleted = TRUE` tanpa melakukan penghapusan baris fisik `candidates`.
5. **`GET /api/candidates`**: Mengambil daftar kandidat dengan pagination (`page`, `limit`), filter `job_id`, `status` (`queued`, `analyzing`, `waiting_approval`, dst.), dan pengurutan skor. Menyertakan `masked_name_hint` untuk identifikasi visual aman tanpa pembukaan PII.
6. **`POST /api/candidates/upload`**: Dropzone HR internal di dashboard untuk mengunggah berkas CV sekaligus secara instan (status awal: `queued`). Wajib menyertakan payload `applicant_meta` (`[{name, email}]`) untuk merekam identitas asli terenkripsi dan mengeksekusi sanitasi PII kamus eksak dua arah.
7. **`POST /api/candidates/{id}/triage` & `POST /api/candidates/batch-triage`**: Pemicu eksekusi agen cerdas on-demand oleh HR yang berjalan via FastAPI `BackgroundTasks` dengan konkurensi terkontrol (`asyncio.Semaphore(3)` untuk mencegah throttling LLM) pada arsitektur single-worker Uvicorn (`--workers 1`). Sistem menyediakan startup recovery query yang mengembalikan kandidat menggantung di status `analyzing` kembali ke `queued` jika server mengalami restart mendadak.
8. **`GET /api/candidates/{id}/trace-stream`**: Endpoint HTTP SSE (Server-Sent Events) terotentikasi via single-use ticket UUID untuk menyiarkan langkah siklus agen per detik.
9. **`POST /api/jobs/{id}/analyze-bias`**: FR-1 Job Analyzer untuk memindai deskripsi pekerjaan terhadap istilah gender-exclusive atau kriteria usia/almamater.
10. **`GET /api/candidates/{id}/evidence-graph`**: Mengembalikan representasi graf untuk komponen visual React Flow, mencakup status verifikasi substring verbatim (`verified`) dan pemenuhan kompetensi spesifik (`matched_requirement`).
11. **`POST /api/jobs/{id}/simulate-policy`**: Endpoint What-If Policy Simulation in-memory:

- Parameter `min_overall_score` (default 75.0) berfungsi sebagai nilai ambang dinamis yang menggantikan cut-off `STRONG_MATCH` standar (85.0) dalam simulasi.

12. **`GET /api/slots/available`**: Mengambil daftar slot wawancara kosong milik pewawancara untuk alokasi jadwal.
13. **`POST /api/slots/reserve`**: Melakukan penguncian atomic pada jadwal wawancara dengan verifikasi non-overlap.
14. **`POST /api/candidates/{id}/review`**: Menyerahkan keputusan akhir HR (`APPROVED_DISPATCH`, `REQUEST_INFO`, `OVERRIDE_REJECT`, `REJECT_CONFIRMED`). Pada alur approval yang sekaligus mengalokasikan slot wawancara, transaksi mematuhi urutan penguncian transaksional baku (`users` -> `interview_slots` -> `candidates`) untuk mencegah deadlock dengan transaksi konkuren lainnya.
15. **`POST /api/candidates/{id}/sse-ticket`**: Menerbitkan token UUID single-use (TTL 60 detik pada in-memory ticket store) untuk koneksi aman ke endpoint `/trace-stream`.
16. **`GET /api/slots`**: Endpoint pengambilan daftar slot wawancara terpusat (tersedia, dipesan, tentatif) dilengkapi tautan template URL ekspor 1-klik ke Google Calendar pribadi tanpa memerlukan otorisasi OAuth server-side (zero-credential).
17. **`GET /api/blog` & `GET /api/blog/{slug}`**: Endpoint publik portal artikel wawasan rekrutmen berkelanjutan, inspirasi talenta digital, dan keterbukaan tata kelola AI.
18. **`POST/PUT/DELETE /api/blog`**: Endpoint CMS internal bagi role `admin` untuk mengelola publikasi artikel, ringkasan, gambar sampul, dan estimasi waktu baca.

---

## 9. RENCANA PENGUJIAN & VALIDASI INDEPENDEN

### 9.1 Skenario Uji 4 Kasus Komprehensif

1. **Kasus 1: Kandidat Valid (Budi Santoso - Strong Match)**
   - _Karakteristik:_ 5 tahun backend engineer, commit repo GitHub aktif sesuai username profil, metrik latency 40% terverifikasi regex, linieritas karier bersih.
   - _Target Evaluasi:_ Skor $\ge 85.0$, Keyakinan `HIGH`, Risiko `LOW`, Rekomendasi `STRONG_MATCH`, alokasi slot wawancara tentative berhasil.
2. **Kasus 2: Kandidat Anomali (Reza Pratama - Review Required)**
   - _Karakteristik:_ Klaim 5 tahun, terdeteksi overlap 17 bulan di 2 perusahaan full-time bersamaan (interval digabung, anomali dicatat).
   - _Target Evaluasi:_ Status Risiko `HIGH`, Soal asesmen konkurensi L2 di-generate, Rekomendasi `REVIEW_REQUIRED`, notifikasi review terkirim ke HR.
3. **Kasus 3: Kandidat Non-Relevan (Citra Lestari - Weak Fit)**
   - _Karakteristik:_ Resume desain grafis untuk posisi Backend Engineer ($N_{skill} = 0$).
   - _Target Evaluasi:_ Skor $< 60.0$, Rekomendasi `WEAK_FIT`, masuk ke antrean penolakan yang membutuhkan konfirmasi `REJECT_CONFIRMED` satu klik HR.
4. **Kasus 4: Concurrency Self-Healing Demo**
   - _Karakteristik:_ Parameter `simulate_conflict: true` (pada konfigurasi `DEMO_MODE=true`).
   - _Target Evaluasi:_ Backend mendeteksi kegagalan `rowcount == 0`, otomatis mengunci slot kalender kosong berikutnya, mencatat status `RECOVERED` di tabel audit, tanpa melempar eror 409 ke UI.

### 9.2 Metodologi Pengujian Mini-Evaluasi Riil (Hari 9)

Untuk memastikan data pengujian yang disajikan dalam proposal dan presentasi juri 100% dapat dipertanggungjawabkan:

1. **Pengujian Akurasi & Determinisme Ekstraksi (Mini-Benchmark):**
   - Menggunakan dataset **20–30 Resume Sintetis Terstandarisasi (sesuai pencapaian)** mencakup berbagai level pengalaman.
   - **Uji Determinisme (Cache Dinonaktifkan):** Menjalankan ekstraksi 5x pada sampel identik (Suhu 0.0) dengan cache `file_hash` dimatikan secara eksplisit untuk menguji stabilitas LLM. Target kelulusan: 100% konsistensi penjenjangan tier klaim teknis dan ketiadaan deviasi kategori rekomendasi.
   - Uji Kepatuhan Skema: 100% valid terhadap model Pydantic v2.
2. **Counterfactual Fairness Test (Uji Keadilan Nondiskriminasi):**
   - Menjalankan pengujian pertukaran atribut demografis (nama pria vs wanita, universitas tier-1 vs non-tier-1) pada resume kompetensi identik. Target: variansi skor akhir $\le 1.0$ poin pada skala 100 dan keselarasan kategori rekomendasi 100%, membuktikan penolakan bias almamater dan gender.
   - _Uji Kebocoran Teks Bebas (Leakage Resilience):_ Menyisipkan nama kandidat dan nama universitas secara acak di dalam narasi deskripsi proyek teknis untuk memvalidasi ketahanan modul sanitizer dalam mendeteksi dan menghapus entitas PII di luar header kontak standar.
3. **Audit Kebocoran Sanitizer PII:**
   - Evaluasi terhadap teks tersanitasi untuk memastikan tidak ada nama, nomor kontak, email, atau nama kampus yang lolos ke payload LLM (Target recall $\ge 98\%$ pada dataset evaluasi).
4. **Mini Usability Testing (SUS):**
   - Uji keterpakaian antarmuka web bersama **5 responden** (mahasiswa & praktisi rekrutmen).
   - Target evaluasi: Skor System Usability Scale (SUS) $\ge 80.0$ (_Grade A / Excellent_).

---

## 10. JADWAL SPRINT 13 HARI & TENGGAT KOMPETISI

- **Tenggat Pengumpulan UINIC 8.0 (Web Dev):** Jumat, 30 Oktober 2026 pukul 23:59 WIB (Target Submit Tim: **29 Oktober 2026 / H-1**).
- **Tenggat Pengumpulan GTNIC 2026 (AI Agent):** Selasa, 10 November 2026 pukul 23:59 WIB (Target Submit Tim: **9 November 2026 / H-1**).

Jadwal kerja taktis harian dengan strategi _anti-bottleneck_ untuk mengunci kesiapan penuh berkas proposal UINIC 8.0, video demo GTNIC, dan aplikasi live web:

| Hari           | Target Tanggal | Modul Fokus Eksekusi                                | Luaran Terverifikasi (_Deliverables_)                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | -------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hari 1–3**   | 18–20 Okt      | **Core Backend, Golden Dataset & Walking Skeleton** | Setup FastAPI, In-Memory Regex PII sanitizer, Model Adapter 9router (Gemini 3.8), Skor 4D deterministik, 12 tabel MariaDB (termasuk DEK & tracking token). **Penyusunan baseline 20 resume sintetis (Budi, Reza, Citra, dll., target ekspansi 30 jika memungkinkan) dimulai oleh AI Engineer sejak Hari 2**. **Deploy Walking Skeleton ke VPS + Vercel (Maksimal Hari 3)**. Mulai kerangka proposal 30 halaman UINIC. |
| **Hari 4–5**   | 21–22 Okt      | **Interkoneksi, Agent Tools & Uji Sanitizer Awal**  | Mock Calendar Adapter (Idempotency Event ID & `SELECT FOR UPDATE` non-overlap), GitHub REST API verification, SSE stream broadcaster, endpoint on-demand triage. **Uji coba awal modul sanitizer terhadap dataset sintetis**. Penulisan Bab 1–5 Proposal.                                                                                                                                                             |
| **Hari 6–8**   | 23–25 Okt      | **Frontend WOW Factor (React 18)**                  | Public Career Portal (`/careers`), Dashboard HR modern (light theme WebEkspor, kontras WCAG AA), React Flow Evidence Graph interaktif, What-If Policy Simulation Studio, modal review dossier. Penulisan Bab 6–10 Proposal.                                                                                                                                                                                                                        |
| **Hari 9**     | 26 Okt         | **Feature Freeze & Benchmark Evaluasi Riil**        | **FEATURE FREEZE.** Eksekusi mini-evaluasi 20–30 resume sintetis (cache off, target $\ge 95\%$ konsistensi tier klaim & 100% konsistensi rekomendasi akhir), counterfactual fairness test (selisih skor $\le 1.0$ poin), cek kebocoran PII di narasi bebas, dan uji SUS 5 responden.                                                                                                                                  |
| **Hari 10**    | 27 Okt         | **Finalisasi & Integrasi End-to-End Web**           | Gladi resik demo web live end-to-end, pengetesan skenario concurrency self-healing kalender, dan verifikasi stabilitas Vercel + VPS.                                                                                                                                                                                                                                                                                  |
| **Hari 11–12** | 28–29 Okt      | **Finalisasi Dokumen Proposal UINIC 8.0**           | Penyelesaian penulisan proposal 30 halaman 15 Bab (UINIC 8.0) dan draf proposal 15 halaman (GTNIC). **Target Submit UINIC 8.0 H-1 (29 Oktober)** sebagai buffer keamanan jaringan.                                                                                                                                                                                                                                    |
| **Hari 13**    | 30 Okt         | **Batas Akhir UINIC & Transisi Fase GTNIC**         | Monitoring status submission UINIC 8.0. Transisi fokus tim ke produksi video demo 3–5 menit GTNIC dan pematangan proposal GTNIC hingga tenggat 9 November 2026.                                                                                                                                                                                                                                                       |
