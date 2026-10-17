# WORKLOG - WILLY (FRONTEND & PRODUCT UI/UX)

Peran: Developer 3  
Tanggung Jawab: React 18 SPA + Vite, Tailwind CSS Enterprise Dark Theme, Candidate Evidence Graph (React Flow), What-If Simulation Studio, Public Career & HR Portal, Vercel Edge Deployment & State Management.

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
  - Penerapan tema visual **Enterprise Dark Mode** (palet warna slate/zinc, aksen cyan/blue, glassmorphism panel, dan micro-animations).
  - Pembangunan kerangka layout shell **Dashboard HR Recruiter**:
    - Sidebar navigasi modular dengan status pelacak sprint.
    - Topbar header responsif dengan indikator tenant dan integrasi badge kesehatan backend.
    - Dashboard Overview dengan kartu metrik ringkasan (Total Kandidat, Rasio Strong Match, Rasio Review, Kepatuhan UU PDP No. 27/2022).
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
