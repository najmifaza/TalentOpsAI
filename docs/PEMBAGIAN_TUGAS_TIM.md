# PANDUAN PEMBAGIAN TUGAS PROGRAMMING (TIM 3 DEVELOPER) - TALENTOPS AI

Dokumen teknis ini mengatur pembagian tugas pemrograman (*software engineering*), kepemilikan modul kode (*codebase ownership*), matriks tanggung jawab teknis (RACI), dan rencana sprint pengembangan aplikasi untuk **Tim Pengembang TalentOps AI**:
* **Developer 1 (Backend, Database & Security):** **Najmi**
* **Developer 2 (AI Agent Logic & Evaluation):** **Fardizza**
* **Developer 3 (Frontend & Product UI/UX):** **Willy**

Fokus dokumen ini adalah **100% implementasi teknis perangkat lunak**, pengujian kode (*automated testing & benchmarking*), serta *deployment* sistem (Vercel & VPS).

Dokumen acuan arsitektur & spesifikasi API: [PRD_TALENTOPS_AI_MASTER.md](file:///d:/Coding/GitHub/LombaUndip/PRD_TALENTOPS_AI_MASTER.md)

---

## 1. PEMETAAN PERAN & ARSITEKTUR SUBSISTEM

```
                               +------------------------------------------+
                               |     TIM DEVELOPER TALENTOPS AI (3 ORANG) |
                               +--------------------+---------------------+
                                                    |
         +------------------------------------------+------------------------------------------+
         |                                          |                                          |
         v                                          v                                          v
+-------------------------------+          +-------------------------------+          +-------------------------------+
|      DEV 1: NAJMI             |          |     DEV 2: FARDIZZA           |          |       DEV 3: WILLY            |
| Backend, DB & Security Eng    |          | AI Logic & Data Engine Eng    |          | Frontend & Web Experience Eng |
+-------------------------------+          +-------------------------------+          +-------------------------------+
| - FastAPI Async Core Engine   |          | - 9router Gateway (Gemini 3.8)|          | - React 18 SPA + Vite         |
| - MariaDB 12 Tabel ACID       |          | - Pydantic v2 Extraction      |          | - React Flow Evidence Graph   |
| - In-Memory Regex PII & KEK   |          | - Deterministic 4D Scoring    |          | - What-If Simulation Studio   |
| - Calendar Lock & GitHub API  |          | - Golden Dataset (20-30 CV)   |          | - Public Career & HR Portal   |
| - VPS Deployment & Nginx CSP  |          | - Fairness & Determinism Test |          | - Vercel Edge Deploy & State  |
+-------------------------------+          +-------------------------------+          +-------------------------------+
```

---

## 2. DETAIL TANGGUNG JAWAB TEKNIS PER DEVELOPER

### **Developer 1 (Najmi): Backend, Database, Security & Infrastructure**
*Fokus: Server engine, arsitektur database transaksional, kriptografi keamanan data, integrasi API eksternal, dan infrastruktur cloud.*

* **Tumpukan Teknologi:** Python 3.11+, FastAPI, MariaDB/InnoDB, SQLAlchemy / PyMySQL, `cryptography` (AES-256-GCM), Nginx, Docker/VPS Linux.
* **Tanggung Jawab Pemrograman (Codebase):**
  1. **Core API & Streaming:**
     - Setup arsitektur FastAPI modular, dependency injection, CORS, custom exception handlers, dan background worker (`asyncio.Queue` / `BackgroundTasks`).
     - Endpoint Server-Sent Events (SSE) `/api/triage/stream/{candidate_id}` untuk penyiaran langkah eksekusi agen secara real-time.
  2. **Relational Database (12 Tabel MariaDB ACID):**
     - Desain migrasi DDL untuk 12 tabel inti (termasuk `candidates`, `triage_records`, `interview_slots`, `erasure_requests`, dll.).
     - Transaksi ACID dengan indeks komposit pada `tenant_id`, `file_hash`, dan timestamp pencarian.
  3. **Keamanan, Sanitasi & Kepatuhan UU PDP No. 27/2022:**
     - Modul *In-Memory Regex PII Sanitizer* (< 20 ms latensi, 0 MB memory overhead) untuk masking nama, kontak, gender, kampus sebelum teks dikirim ke LLM.
     - *Envelope Encryption (KMS Lokal):* Enkripsi AES-256-GCM untuk kolom identitas sensitif (`encrypted_email`, `encrypted_dek`) dengan blind indexing HMAC-SHA256.
     - Endpoint *Right to Erasure* (`DELETE /api/candidates/{id}`) dengan soft-deletion kriptografis (penghancuran DEK lokal + `is_deleted = TRUE`).
  4. **Adapter Integrasi & Bounded Self-Healing:**
     - Mock Calendar Adapter dengan mekanisme transaksi atomik (`SELECT ... FOR UPDATE`) untuk mengeliminasi risiko *double-booking* reservasi wawancara.
     - GitHub REST API v3 adapter untuk validasi eksistensi repo, kepemilikan, bahasa utama, dan stars/forks.
  5. **Infrastruktur & Server Deployment:**
     - Setup VPS Linux, instalasi MariaDB, Nginx reverse proxy, SSL/HTTPS certs, dan penguncian header keamanan (CSP, HSTS, X-Content-Type).

---

### **Developer 2 (Fardizza): AI Agent Logic, Scoring Engine & Evaluation**
*Fokus: Integrasi model LLM, rekayasa prompt anti-injeksi, formula kalkulasi matematis skor 4D, dataset generator, dan skrip pengujian otomatis.*

* **Tumpukan Teknologi:** 9router LLM Gateway (Gemini 3.8 / Antigravity), Pydantic v2, Python Math/NumPy, Pytest, JSON Schema.
* **Tanggung Jawab Pemrograman (Codebase):**
  1. **Model Adapter Layer (Gemini 3.8 via 9router):**
     - Integrasi koneksi HTTP client asinkron ke 9router Gateway dengan timeout, retry backoff eksponensial, dan fallback parser.
     - Rekayasa prompt *Single-Pass Structured Extraction* yang diperkuat sistem pertahanan *Indirect Prompt Injection Guard* (Bab 6.1 PRD).
  2. **Validasi Skema Terstruktur (Pydantic v2):**
     - Pemodelan skema Pydantic ketat (`CandidateExtractionSchema`, `CompetencyItem`, `AnomalyFlags`, `has_implementation_detail`).
     - Sirkuit penanganan error bila LLM mengembalikan JSON malformed (Bounded Self-Healing Engine).
  3. **Deterministic 4D Scoring Engine:**
     - Implementasi logika perhitungan skor murni di Python tanpa memanggil ulang API LLM:
       - $S_{\text{comp}}$: Core Competencies Coverage & Framework Taxonomy Mapping.
       - $S_{\text{port}}$: Portofolio & GitHub verified code weight.
       - $S_{\text{conf}}$: Metrik keyakinan ekstraksi berbasis bukti faktual.
       - $S_{\text{risk}}$: Penalti anomali (overlapping dates, keyword stuffing, hidden text).
     - Logika penentuan *Agent Decision Points* otomatis (`Auto-Pass`, `Manual Triage`, `Reject`).
  4. **Golden Testing Dataset Generator:**
     - Menyiapkan modul data generator berisi **20–30 Berkas Resume Sintetis** (PDF & DOCX) dengan profil terstandarisasi untuk skenario pengujian: kandidat jujur, jeda karier, *font 0pt hidden text*, manipulasi klaim senioritas, dan portofolio fiktif.
  5. **Skrip Otomasi Pengujian & Benchmark:**
     - Skrip uji determinisme (5x eksekusi pada Suhu 0.0 dengan cache `file_hash` off).
     - Skrip uji *Counterfactual Fairness Test* (pertukaran nama gender pria/wanita & universitas tier-1 vs non-tier-1 dengan delta skor target $\le 1.0$).
     - Skrip audit kebocoran sanitizer PII pada teks bebas (target recall $\ge 98\%$).

---

### **Developer 3 (Willy): Frontend Architecture, Interactive UI & State Management**
*Fokus: Web client SPA modern, visualisasi graf interaktif, studio simulasi waktu-nyata, dan integrasi API.*

* **Tumpukan Teknologi:** React 18, Vite 5, TypeScript / JavaScript modern, Tailwind CSS, React Flow, Lucide Icons, Vercel Edge.
* **Tanggung Jawab Pemrograman (Codebase):**
  1. **Arsitektur Client & Design System:**
     - Setup React 18 + Vite dengan layout modular, dark-mode enterprise theme, micro-animations, dan toast notifications.
     - State management lokal & asinkron untuk cache query, status filter pelamar, dan token auth.
  2. **Public Career Portal (`/careers/apply`):**
     - Formulir lamaran kandidat dengan komponen drag-and-drop file uploader (PDF/DOCX), validasi MIME-type di browser, checkbox persetujuan DPA, dan dialog penerbitan *tracking token*.
     - Halaman pelacakan status kandidat berbasis token (`/careers/track/{token}`): Frontend wajib menggunakan `tracking_token` (UUIDv4) untuk fetch data API, sedangkan `masked_identifier` (`#TK-XXXXXX`) hanya untuk tampilan display visual.
  3. **HR Recruiter Dashboard:**
     - Tampilan tabel dossier kandidat terurut berdasarkan `triage_priority` dan `confidence_score`.
     - Filter pencarian berbasis taksonomi teknologi, status kelulusan, dan flag anomali.
     - Komponen pendengar Live SSE Stream (`EventSource`) untuk menampilkan animasi trace langkah otonom agen secara real-time.
     - Modal interaktif dossier kandidat: ringkasan riwayat karier, gap kompetensi, dan tombol interaktif *Approve / Reject / Schedule Interview*.
  4. **Fitur Visualisasi Interaktif Utama:**
     - **Candidate Evidence Graph (React Flow):** Visualisasi graf node interaktif yang menghubungkan klaim kompetensi langsung ke kutipan teks resume dan metadata repositori GitHub terverifikasi.
     - *Penanganan Role Non-Programmer:* Untuk lowongan non-programmer (UI/UX, PM, dll.), visualisasi graf melewati audit GitHub dan menampilkan badge status `NOT_APPLICABLE` (bukan status error merah).
     - **What-If Policy Simulation Studio:** Panel slider interaktif untuk simulasi pergeseran bobot penilaian 4D secara instan di browser (in-memory) tanpa latensi backend.
  5. **Client Deployment & Optimasi:**
     - Setup hosting pada Vercel Global Edge Network, konfigurasi rewrite rules `vercel.json`, code splitting, dan kompresi bundle asset.
     - Konfigurasi HTTP Header Content Security Policy (CSP) produksi pada `vercel.json` (`connect-src 'self' https://api.talentops.id`), tanpa mencantumkan port dev lokal.

---

## 3. MATRIKS TANGGUNG JAWAB TEKNIS (RACI ENGINEERING MATRIX)

| Modul & Komponen Teknis | Najmi (Backend/DB) | Fardizza (AI/Scoring) | Willy (Frontend/UI) |
| :--- | :---: | :---: | :---: |
| **Repositori & Inisialisasi Project Base** | **A / R** | R | R |
| **FastAPI Core Engine & Router Setup** | **A / R** | C | I |
| **Skema Basis Data 12 Tabel MariaDB ACID** | **A / R** | C | I |
| **In-Memory Regex PII Sanitizer (<20ms)** | **A / R** | C | I |
| **Envelope Encryption AES-256-GCM & Erasure** | **A / R** | I | I |
| **Mock Calendar (`SELECT FOR UPDATE`) & GitHub API** | **A / R** | I | C |
| **SSE Event Stream Broadcaster** | **A / R** | I | R (Consumer) |
| **9router Gateway Client (Gemini 3.8)** | C | **A / R** | I |
| **Skema Pydantic v2 & Extraction Prompt** | C | **A / R** | I |
| **Deterministic 4D Scoring Engine** | C | **A / R** | I |
| **Generator Golden Dataset (20-30 CV)** | I | **A / R** | I |
| **Skrip Uji Determinisme & Fairness** | I | **A / R** | I |
| **Setup React 18 + Vite + Design Tokens** | I | I | **A / R** |
| **Public Career Portal (`/careers/apply`)** | C (API `/apply`) | I | **A / R** |
| **HR Recruiter Dashboard & Triage Queue** | C (API `/candidates`) | I | **A / R** |
| **Candidate Evidence Graph (React Flow)** | I | C (Node Schema) | **A / R** |
| **What-If Policy Simulation Studio UI** | I | C (Math Formula) | **A / R** |
| **Deployment VPS (Linux, MariaDB, Nginx)** | **A / R** | I | I |
| **Deployment Vercel (Edge, Routing, Bundling)** | I | I | **A / R** |

---

## 4. RENCANA PENGEMBANGAN TEKNIS BERBASIS SPRINT

```
[Sprint 1: Fondasi Arsitektur & Walking Skeleton] ──► Inisiasi FastAPI, MariaDB, 9router, React UI, Deploy Skeleton
                       │
[Sprint 2: Data Ingestion, Ekstraksi & Interkoneksi] ─► Ingestion Portal, Structured Prompt, 4D Scoring, SSE Broadcaster
                       │
[Sprint 3: Fitur Visual Lanjutan, Keamanan & Self-Healing] ─► Evidence Graph, What-If Studio, PII Crypto, Atomic Calendar
                       │
[Sprint 4: Pengujian Otomatis, Konkurensi & Benchmark] ──► Uji Konkurensi 50 Tx, Determinism Test, Fairness Test SDG 8
                       │
[Sprint 5: Production Hardening & Stabilitas End-to-End] ─► VPS Nginx Hardening, Bundle Optimize, Zero-Bug Live Demo
```

---

### Rincian Pengerjaan Kode per Sprint:

#### **Sprint 1: Architecture Foundation & Walking Skeleton**
*Target: Membangun pipeline end-to-end hidup (Walking Skeleton) dari web client hingga database dan cloud deployment.*
* **Najmi (Backend):**
  * Inisiasi project FastAPI, setup CORS, konfigurasi environment variables (`.env`).
  * Desain DDL dan migrasi awal skema 12 tabel MariaDB/InnoDB.
  * Deploy skeleton backend ke VPS (koneksi database terverifikasi, endpoint `/api/health` aktif).
* **Fardizza (AI/Data):**
  * Inisiasi adapter HTTP client ke 9router Gateway (Gemini 3.8).
  * Pembuatan skema dasar Pydantic v2 untuk parsing JSON resume.
  * Inisiasi format 5 data resume sintetis dasar untuk pengujian parsing awal.
* **Willy (Frontend):**
  * Inisiasi project React 18 + Vite dengan Tailwind CSS di Vercel.
  * Setup token warna Dark Mode, komponen navigasi, dan layout shell Dashboard HR.
  * Verifikasi koneksi fetch dari frontend Vercel ke endpoint `/api/health` di VPS.
* **Kriteria Selesai (DoD Sprint 1):** Walking skeleton aktif; request dari UI Vercel berhasil direspons oleh backend VPS dan tercatat di MariaDB.

---

#### **Sprint 2: Data Ingestion, Model Extraction & Core Interconnection**
*Target: Alur berkas resume masuk, diekstrak LLM, dihitung skornya, diverifikasi ke GitHub, dan disiarkan via SSE.*
* **Najmi (Backend):**
  * Implementasi endpoint upload berkas kandidat (`POST /api/candidates/apply` & dropzone HR).
  * Implementasi Mock Calendar Adapter dengan atomic lock query (`SELECT ... FOR UPDATE`).
  * Implementasi integrasi GitHub REST API v3 (verifikasi repo publik).
  * Implementasi generator Server-Sent Events (SSE) `/api/triage/stream/{candidate_id}`.
* **Fardizza (AI/Data):**
  * Penyempurnaan system prompt *Single-Pass Extraction* anti-injeksi dengan skema Pydantic v2 lengkap.
  * Implementasi modul kalkulasi matematis *Deterministic 4D Scoring Engine* ($S_{\text{comp}}, S_{\text{port}}, S_{\text{conf}}, S_{\text{risk}}$).
  * Implementasi logika penentuan *Agent Decision Points* (`Auto-Pass`, `Manual Triage`, `Reject`).
* **Willy (Frontend):**
  * Pembuatan formulir Public Career Portal (`/careers/apply`) dengan drag-drop uploader dan dialog *tracking token*.
  * Integrasi listener SSE di HR Dashboard untuk menampilkan log trace penalaran agen secara real-time.
  * Komponen awal visualisasi Candidate Evidence Graph menggunakan React Flow.
* **Kriteria Selesai (DoD Sprint 2):** Resume yang diunggah otomatis tersanitasi, diekstrak Gemini 3.8, dihitung skor deterministiknya, dan hasilnya tampil di UI via SSE.

---

#### **Sprint 3: Advanced Features, Security & Interactive WOW Factor**
*Target: Penyelesaian fitur pembeda (What-If Studio, enkripsi PII, dan ketahanan transaksi kalender).*
* **Najmi (Backend):**
  * Modul *In-Memory Regex PII Sanitizer* (< 20 ms) yang menyensor nama, kontak, dan kampus sebelum payload dikirim ke AI.
  * Implementasi *Envelope Encryption* AES-256-GCM lokal untuk `encrypted_email` & `encrypted_dek`.
  * Endpoint soft-deletion kriptografis (`DELETE /api/candidates/{id}`).
  * Konfigurasi security headers (CSP, HSTS, X-Frame-Options) dan rate limiting.
* **Fardizza (AI/Data):**
  * Modul komputasi *What-If Policy Simulation* (re-scoring seketika berbasis modifikasi bobot slider tanpa memanggil API LLM).
  * Penyelesaian ekspansi **Golden Dataset menjadi total 20–30 Resume Sintetis** (mencakup kasus manipulasi *invisible font*, *keyword stuffing*, dan *career gap*).
* **Willy (Frontend):**
  * Selesai penuh **What-If Policy Simulation Studio UI** dengan slider bobot interaktif dan re-ranking tabel real-time.
  * Selesai penuh **Candidate Evidence Graph (React Flow)** dengan node kustom, badge verifikasi GitHub, dan kutipan teks asli.
  * Modal peninjauan dossier kandidat lengkap dengan tombol interaktif persetujuan dan penjadwalan kalender.
* **Kriteria Selesai (DoD Sprint 3):** Semua fitur fungsional 100% interaktif di browser; simulator What-If berjalan mulus tanpa lag.

---

#### **Sprint 4: Automated Testing, Concurrency & Verification Suite**
*Target: Pengujian stres teknis dan verifikasi otomatis seluruh metrik performa sistem.*
* **Najmi (Backend):**
  * Skrip uji konkurensi kalender: simulasi 50 transaksi reservasi simultan untuk membuktikan nol insiden *double-booking*.
  * Pengukuran latensi end-to-end triage (target p50 $\le 5.730\text{ ms}$, p95 $\le 10.010\text{ ms}$).
* **Fardizza (AI/Data):**
  * Menjalankan automated test suite:
    * *Determinism Test:* 5x eksekusi pada 5 sampel dengan cache dimatikan (target 100% konsistensi tier klaim).
    * *Counterfactual Fairness Test:* Pertukaran identitas demografi gender & almamater (target delta skor $\le 1.0$).
    * *PII Leakage Audit:* Uji recall sensor entitas pada narasi bebas (target recall $\ge 98\%$).
* **Willy (Frontend):**
  * Pengujian responsivitas antarmuka di berbagai resolusi layar (desktop, tablet, mobile).
  * Pengujian edge-cases antarmuka: penanganan file corrupt, network disconnection saat streaming SSE, dan validasi form input.
* **Kriteria Selesai (DoD Sprint 4):** Seluruh automated test lulus 100%; data metrik konkurensi, determinisme, dan keadilan tersimpan dalam log pengujian.

---

#### **Sprint 5: Production Hardening & Full Deployment Integration**
*Target: Penguncian stabilitas sistem, optimasi performa web, dan kesiapan live demo tanpa kendala.*
* **Najmi (Backend):**
  * Optimasi query MariaDB (verifikasi `EXPLAIN` query, composite indexing).
  * Hardening reverse proxy Nginx pada VPS, manajemen koneksi keep-alive, dan SSL grade A.
  * Finalisasi dokumentasi API otomatis di Swagger/OpenAPI (`/docs`).
* **Fardizza (AI/Data):**
  * Fine-tuning prompt token payload untuk efisiensi biaya dan kecepatan response 9router.
  * Pengetesan skenario kegagalan koneksi LLM untuk memvalidasi sirkuit Bounded Self-Healing fallback.
* **Willy (Frontend):**
  * Optimasi bundle frontend (Vite code splitting, lazy loading komponen React Flow, tree shaking).
  * Audit Lighthouse performance, accessibility, dan SEO di Vercel.
  * Final visual polish: kelancaran transisi micro-interactions dan penyesuaian visual Dark Mode.
* **Kriteria Selesai (DoD Sprint 5):** Sistem berstatus *PRODUCTION READY*; web live demo di Vercel & backend VPS beroperasi stabil dengan latensi rendah dan nol *runtime crash*.

---

## 5. PROTOKOL KERJA REKAYASA PERANGKAT LUNAK (ENGINEERING RULES)

1. **Prinsip Kontrak Data Baku (Contract-First Development):**  
   Willy (Frontend) tidak boleh menunggu endpoint Najmi (Backend) selesai. Manfaatkan skema JSON baku pada [Bab 8.2 PRD](file:///d:/Coding/GitHub/LombaUndip/PRD_TALENTOPS_AI_MASTER.md#L670) sebagai *mock service worker* lokal di frontend sejak Sprint 1.
2. **Skema Validasi Output Model (Zero Raw Text):**  
   Fardizza (AI/Data) wajib membungkus seluruh luaran Gemini 3.8 ke dalam Pydantic Model sebelum diserahkan ke Najmi (Backend) untuk dikalkulasi dan disimpan ke MariaDB. Dilarang meneruskan string mentah (*unparsed text*) ke database.
3. **Konvensi Percabangan Git & Skema Merge Mandiri:**
   - **Struktur Branching:**
     - `main`: Branch produksi stabil. Terhubung otomatis ke CI/CD deployment Vercel & VPS.
     - `feat/<role>-<fitur>`: Branch kerja per sub-fitur spesifik (bukan nunggu satu sprint penuh selesai).
       - Contoh Najmi: `feat/backend-auth`, `feat/backend-db-schema`, `feat/backend-calendar-lock`
       - Contoh Fardizza: `feat/ai-9router-client`, `feat/ai-pydantic-schema`, `feat/ai-4d-scoring`
       - Contoh Willy: `feat/ui-career-portal`, `feat/ui-evidence-graph`, `feat/ui-whatif-studio`
   - **Skema Alur Kerja (Work -> Self-Merge -> Pull):**
     ```
     [Branch main] ───────────────┬───────────────────────────────► [Auto Deploy VPS/Vercel]
                                  │ (checkout branch baru)            ▲
                                  v                                   │
     [Branch feat/<role>-<fitur>] ──► [Coding & Self-Test] ──► [PR GitHub] (Self-Merge / Review)
     ```
   - **Aturan Merge Mandiri (Self-Merge as Contributor):**
     - **Merge per Sub-Fitur (Atomic Merge):** Jangan menunda merge sampai akhir sprint. Begitu 1 sub-fitur selesai diuji lokal, langsung buat PR dan merge ke `main` agar anggota lain bisa segera `git pull origin main`.
     - **Izin Self-Merge:** Karena semua anggota tim berstatus kontributor repository, pembuat branch diizinkan melakukan **Self-Merge** (Squash and Merge) tanpa harus menunggu approval formal, asalkan:
       1. Kode tidak broken (server lokal bisa running, frontend lulus `npm run build`).
       2. Fitur teruji di lokal dan tidak mengubah file di luar kepemilikan foldernya.
       3. Beri notifikasi singkat di grup WhatsApp setelah merge berhasil.
     - **Ritual Sinkronisasi:** Sebelum membuat branch baru atau sebelum push, wajib jalankan `git checkout main && git pull origin main` agar basis kode lokal selalu sinkron dengan branch produksi.
4. **Isolasi Modul & Penanganan Risiko Tabrakan (Zero-Conflict Parallel Execution):**
   - **Frontend vs Backend (Sprint 1–2):** Willy bekerja penuh menggunakan Mock JSON statis berbasis kontrak PRD Bab 5.1 & 8.2 (via Mock Service Worker / fixtures lokal). Frontend tidak bergantung pada kesiapan endpoint live VPS.
   - **AI Logic vs Database Ingestion (Sprint 2):** Skema Pydantic (`schemas/extraction.py`) dikunci Fardizza sebagai *single source of truth* sebelum prompt dioptimasi atau query database ditulis Najmi.
   - **Separasi Fisik Direktori Codebase:** Pembagian folder root diisolasi menjadi `backend/` (Najmi), `ai_engine/` (Fardizza), dan `frontend/` (Willy) untuk mengeliminasi potensi konflik merge pada file bersama. Modifikasi file bersama di root (`.env.example`, `docker-compose.yml`) wajib disepakati via komunikasi singkat tim.
5. **Kewajiban Pengisian & Pembacaan Worklog Mandiri (`docs/worklogs/`):**
   - **Ritual Wajib Baca Log Rekan:** Sebelum mulai ngoding atau membuat branch baru, setiap anggota tim **wajib membaca worklog rekan satu tim terlebih dahulu** (khususnya `LOG_NAJMI.md` untuk mengetahui URL endpoint live, skema data, konfigurasi CSP, dan token format) agar progres selalu sinkron dan tidak terjadi tabrakan konfigurasi.
   - **Pencatatan Mandiri:** Setiap developer yang mulai berkontribusi pada penulisan kode wajib mencatat pekerjaan hariannya pada file markdown masing-masing di direktori `docs/worklogs/` (`LOG_NAJMI.md`, dan membuat file sendiri saat mulai aktif, misal `LOG_WILLY.md`, `LOG_FARDIZZA.md`).
   - Format wajib per entri: tanggal (`YYYY-MM-DD`), nama pengembang, komponen/file yang diubah, uraian pekerjaan konkret, status/verifikasi pengujian lokal, dan rencana langkah selanjutnya.
   - Entri worklog wajib di-commit bersamaan dengan kode fitur sebelum branch di-merge ke `main` sebagai bukti otentik kontribusi teknis untuk rubrik penilaian tim pada kompetisi UINIC 8.0 & GTNIC 2026.
