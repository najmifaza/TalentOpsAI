# WORKLOG - WILLY (FRONTEND & PRODUCT UI/UX)

Peran: Developer 3  
Tanggung Jawab: React 18 SPA + Vite, Tailwind CSS Modern Natural Pine & Sage Theme, Candidate Evidence Graph (React Flow), What-If Simulation Studio, Public Career & HR Portal, Vercel Edge Deployment & State Management.

---

### 2026-10-17 - Willy - Fondasi Frontend & Walking Skeleton (Sprint 1)
- **Komponen / File:**
  - `frontend/package.json`
  - `frontend/vite.config.js`
  - `frontend/tailwind.config.js`
  - `frontend/postcss.config.js`
  - `frontend/vercel.json`
  - `frontend/.env` & `frontend/.env.example`
  - `frontend/index.html`
  - `frontend/src/main.jsx`
  - `frontend/src/index.css`
  - `frontend/src/App.jsx`
  - `frontend/src/components/Sidebar.jsx`
  - `frontend/src/components/Header.jsx`
  - `frontend/src/components/HealthStatusBadge.jsx`
  - `frontend/src/components/DashboardOverview.jsx`
  - `frontend/src/components/CandidateTable.jsx`
  - `frontend/src/components/CandidateModal.jsx`
  - `frontend/src/components/PlaceholderView.jsx`
  - `frontend/src/data/mockCandidates.js`
- **Yang Dikerjakan:**
  - Inisialisasi struktur arsitektur SPA **React 18 + Vite 5** dengan styling **Tailwind CSS**.
  - **Penerapan Tema Visual Human-Crafted Modern (Anti AI-Slop):**
    - Menghindari dark mode generik/hitam legam agar tidak terkesan klise AI.
    - Mengadopsi palet warna organik terkurasi: Deep Forest Pine (`#051F20`, `#0B2B26`, `#163832`), Soft Sage (`#8EB69B`), Mint Cream (`#DAF1DE`), serta Clean Mint-Tinted Canvas (`#EEF4F0`).
    - Tipografi modern **Plus Jakarta Sans** dipadukan dengan **Inter**.
    - Desain kartu analitik modern dengan grafik mini-bar chart, semi-circular match rate gauge (76.5%), distribusi bobot 4D, dan banner arsitektur forest green.
  - Pembangunan kerangka layout shell **Dashboard HR Recruiter**:
    - Sidebar navigasi hijau hutan (`#0B2B26`) dengan widget profil akun pengembang (Willy Narendra) dan status pelacak sprint.
    - Topbar header bersih dengan tombol aksi cepat (*Add Custom AI Filter*) dan integrasi badge kesehatan backend.
    - Dashboard Overview dengan kartu metrik ringkasan (Core Competency Index, Determinism & Fairness, Kepatuhan UU PDP No. 27/2022).
  - Pembangunan tabel dossier antrean kandidat dengan implementasi:
    - Masked Identifier (`#TK-XXXXXX`) dan nama tersensor untuk perlindungan privasi UU PDP.
    - Visualisasi skor 4D deterministik ($S_{\text{comp}}, S_{\text{port}}, S_{\text{conf}}, S_{\text{risk}}$).
    - Status badge audit GitHub terverifikasi dan penanganan non-programmer (`NOT_APPLICABLE`).
    - Modal interaktif inspeksi rincian dossier kandidat dan simulasi keputusan HR.
  - Penyiapan fixture mock dataset 5 kandidat berbasis Golden Dataset baseline (Budi Santoso, Reza Pratama, Citra Lestari, Dewi Sartika, Eko Prasetyo) sesuai kontrak data PRD Bab 8.2 & 9.1.
  - **Integrasi Walking Skeleton (Client &rarr; VPS &rarr; DB):**
    - Komponen `HealthStatusBadge` yang melakukan polling fetch real-time ke live backend VPS (`https://api-talentops.fawt.biz.id/api/health`).
    - Menampilkan status live indikator konektivitas API, database MariaDB, mode demo sandbox, serta pengukuran latensi round-trip (ms).
  - **Konfigurasi Produksi Vercel (`vercel.json`):**
    - Rewrite rules SPA (`/(.*)` &rarr; `/index.html`).
    - Header Content Security Policy (CSP) ketat yang mengunci sumber daya koneksi hanya ke backend live: `connect-src 'self' https://api-talentops.fawt.biz.id;`.
- **Status & Verifikasi:** Selesai 100%. Walking skeleton client web terbukti sukses membaca respons live backend VPS dan status database MariaDB. Kompilasi bundle frontend lolos `npm run build` tanpa error.
- **Catatan untuk Backend & AI Engineer:**
  - *Mock Service Worker:* Frontend saat ini menggunakan skema JSON baku dari `mockCandidates.js` selaras dengan skema Pydantic v2 `CandidateExtractionSchema`.
  - *SSE Listener:* Komponen pendengar event stream siap menerima koneksi endpoint `/api/triage/stream/{candidate_id}` pada Sprint 2.
- **Rencana Selanjutnya (Sprint 2):**
  - Pembuatan form pelamar publik `Public Career Portal` (`/careers/apply`) dengan drag-and-drop resume uploader dan penerbitan *tracking token* anonim.
  - Integrasi listener Live SSE Stream (`EventSource`) pada HR Dashboard untuk menampilkan animasi trace langkah otonom agen secara real-time.
  - Pembuatan komponen visualisasi awal **Candidate Evidence Graph** menggunakan React Flow.

---

### 2026-10-18 - Willy - Data Ingestion Portal, Live SSE Stream & Evidence Graph (Sprint 2 Selesai Penuh)
- **Komponen / File:**
  - `frontend/package.json` & `frontend/package-lock.json`
  - `frontend/src/components/DpaModal.jsx`
  - `frontend/src/components/TokenIssuedModal.jsx`
  - `frontend/src/components/ApplicationTracker.jsx`
  - `frontend/src/components/CareerPortal.jsx`
  - `frontend/src/components/AgentTraceModal.jsx`
  - `frontend/src/components/EvidenceGraph.jsx`
  - `frontend/src/components/Sidebar.jsx`
  - `frontend/src/components/DashboardOverview.jsx`
  - `frontend/src/components/CandidateTable.jsx`
  - `frontend/src/components/CandidateModal.jsx`
  - `frontend/src/App.jsx`
- **Yang Dikerjakan:**
  - **1. Public Career Portal (`/careers/apply` & `/careers/track/{token}`):**
    - Portal karir publik modern dengan palet human-crafted Pine (`#0B2B26`), Sage (`#8EB69B`), dan Mint (`#EEF4F0`).
    - Konsumsi daftar lowongan kerja aktif secara dinamis dari live backend VPS (`GET /api/careers`).
    - Komponen interaktif *Drag-and-Drop Resume Uploader* dengan validasi MIME-type di browser (PDF & DOCX, limit 10 MB).
    - Checkbox persetujuan DPA sesuai mandat UU PDP No. 27/2022 terintegrasi dengan modal edukasi hukum privasi (`DpaModal.jsx`).
    - Integrasi submit form data `multipart/form-data` ke live endpoint VPS (`POST /api/careers/{job_id}/apply`).
    - Dialog penerbitan kredensial pelamar (`TokenIssuedModal.jsx`) memuat *Public Masked Identifier* (`#TK-XXXXXX`) dan *Secret Tracking Token* (UUIDv4).
    - Komponen pelacakan status kandidat berbasis token (`ApplicationTracker.jsx`) terhubung ke endpoint live VPS (`GET /api/careers/track/{token}`) dengan stepper timeline 5 tahap dan tombol pencabutan berkas (*Right to Erasure*).
  - **2. Live SSE Agent Execution Trace Stream Listener (`AgentTraceModal.jsx`):**
    - Listener streaming Server-Sent Events (`EventSource`) mengonsumsi endpoint backend live VPS `/api/candidates/stream/{candidate_id}` selaras dengan `broadcaster.py` buatan Najmi.
    - Visualisasi alur penalaran otonom agen dalam 7 tahap kanonikal (Sanitasi PII In-Memory &lt;20ms &rarr; Scan Teks Tersembunyi DOCX &rarr; Ekstraksi Gemini 3.8 via 9router &rarr; Anti-Hallucination Substring Guard &rarr; Audit GitHub REST API v3 &rarr; Kalkulasi Skor 4D Deterministik &rarr; Keputusan Triage & Atomic Calendar Lock).
    - Terminal live buffer dengan status streaming SSE (`CONNECTING`, `STREAMING`, `COMPLETED`), auto-scroll log buffer, inspeksi payload JSON, serta tombol replay trace.
    - Penambahan tombol aksi `Live SSE` pada setiap baris kandidat di `CandidateTable.jsx` dan widget banner status streaming di `DashboardOverview.jsx`.
  - **3. Candidate Evidence Graph (`EvidenceGraph.jsx` berbasis React Flow):**
    - Instalasi pustaka grafis resmi `@xyflow/react` (React Flow v12).
    - Desain kanvas graf node-link interaktif menghubungkan 4 layer: Root Kandidat Dossier &rarr; Klaim Kompetensi Pydantic v2 &rarr; Kutipan Teks Asli Resume (Grounding Substring Guard) &rarr; Audit Repositori GitHub v3.
    - Implementasi 4 Custom Node React Flow dengan styling enterprise Pine & Sage.
    - **Penanganan Khusus Role Non-Programmer:** Untuk profil non-programmer (Citra Lestari `#TK-C39D44`), node GitHub menampilkan status `NOT_APPLICABLE` (bukan error merah), memenuhi aturan baku PRD & RACI matrix.
    - **Penanganan Anomali Keamanan:** Untuk profil injeksi teks tersembunyi (Dewi Sartika `#TK-D99A12`), edge divisualisasikan merah berkedip dengan indikator deteksi tag `w:vanish`.
    - Dilengkapi selektor 5 profil kandidat instan, MiniMap terintegrasi, Controls zoom/fit, dan legenda alur kredensial.
- **Status & Verifikasi:** Selesai 100%. Kompilasi bundle Vite lolos uji `npm run build` sukses (**1777 modul tertransformasi**, zero error). Seluruh kriteria Definition of Done (DoD) Sprint 2 untuk Developer 3 (Willy) terpenuhi 100%.
- **Arsitektur Routing Web (React Router DOM v7):**
  - Mengganti state internal `useState` navigasi halaman dengan **React Router DOM** untuk mendukung URL routing riil dan deep-linking:
    - Public Career Portal: `/careers`, `/careers/apply`, `/careers/track`, `/careers/track/:token`.
    - HR Dashboard Shell: `/dashboard`, `/evidence-graph`, `/evidence-graph/:candidateId`, `/what-if`, `/security-pdp`.
  - Mengubah seluruh tombol navigasi pada `Sidebar.jsx` menjadi `<NavLink>` dengan styling aktif dinamis.
  - Mendukung input parameter rute `:token` pada URL sehingga pelamar dapat langsung membuka URL status pelacakan dengan prefilled data & auto-fetch.
  - Mendukung input parameter rute `:candidateId` pada Evidence Graph dengan tombol pintasan dari modal dossier kandidat (`CandidateModal.jsx`).
- **Catatan untuk Rekan Tim:**
  - *Frontend Sprint 2 Complete & Fully Routed:* Seluruh modul navigasi telah terintegrasi dengan URL browser sesuai spesifikasi PRD Baris 740 dan Vercel rewrite.
- **Rencana Selanjutnya (Sprint 3):**
  - Pembuatan **What-If Policy Simulation Studio UI** dengan slider bobot interaktif ($S_{\text{comp}}, S_{\text{port}}, S_{\text{conf}}, S_{\text{risk}}$) dan re-ranking tabel real-time in-browser.
  - Finalisasi modal dossier kandidat dengan tombol interaktif penjadwalan kalender wawancara atomik.

