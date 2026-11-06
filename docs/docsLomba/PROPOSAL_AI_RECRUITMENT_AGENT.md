<!-- ================================================================================== -->
<!-- HALAMAN SAMPUL PROPOSAL (COVER PAGE)                                               -->
<!-- Format Layout Sesuai Standar Akademik & Guidebook Resmi GTNIC 2026                 -->
<!-- Standar Fisik: A4, Times New Roman, Spasi 1.5, Margin Kiri 4cm, Lainnya 3cm       -->
<!-- ================================================================================== -->

<style>
  @page {
    size: A4 portrait;
    margin-top: 3cm;
    margin-bottom: 3cm;
    margin-left: 4cm;
    margin-right: 3cm;
  }
  body, article, .markdown-body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #111827;
    text-align: justify;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: "Times New Roman", Times, serif;
    line-height: 1.3;
    font-weight: bold;
    color: #000;
  }
  table {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.3;
  }
</style>

<div align="center">

# PROPOSAL KARYA INOVASI
### GARDA TECH NATIONAL INNOVATION COMPETITION (GTNIC) 2026
**KATEGORI LOMBA: AI AGENT DEVELOPMENT**

<br>

## **TALENTOPS AI : SISTEM REKRUTMEN MANDIRI BERBASIS KECERDASAN BUATAN**

<br><br>

<!-- LOGO GTNIC 2026 & LOGO UNIVERSITAS JENDERAL SOEDIRMAN -->
<p align="center">
  <img src="logo_gtnic.png" alt="Logo GTNIC 2026" width="130" style="margin-right: 25px;" />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="logo_unsoed.png" alt="Logo Universitas Jenderal Soedirman" width="130" />
</p>

<br><br>

**Disusun oleh:**  
**Tim Doa Ibu**

<br>

<table align="center" style="border: none; border-collapse: collapse; margin-left: auto; margin-right: auto; text-align: left; font-size: 12pt;">
  <tr style="border: none;">
    <td style="padding: 3px 15px; border: none;"><strong>Timotius Willy Narendra</strong></td>
    <td style="padding: 3px 5px; border: none;"></td>
    <td style="padding: 3px 15px; border: none;">H1D025052</td>
  </tr>
  <tr style="border: none;">
    <td style="padding: 3px 15px; border: none;"><strong>Adridinan Najmi Faza</strong></td>
    <td style="padding: 3px 5px; border: none;"></td>
    <td style="padding: 3px 15px; border: none;">H1D025059</td>
  </tr>
  <tr style="border: none;">
    <td style="padding: 3px 15px; border: none;"><strong>Fardizza Vinda Rahman</strong></td>
    <td style="padding: 3px 5px; border: none;"></td>
    <td style="padding: 3px 15px; border: none;">H1D025067</td>
  </tr>
</table>

<br><br><br>

### **JURUSAN INFORMATIKA**  
### **FAKULTAS TEKNIK**  
### **UNIVERSITAS JENDERAL SOEDIRMAN**  
### **PURWOKERTO**  
### **2026**

</div>

<div style="page-break-after: always; break-after: page;"></div>

---

# PROPOSAL KARYA GARDA TECH NATIONAL INNOVATION COMPETITION (GTNIC) 2026
**KATEGORI:** AI AGENT DEVELOPMENT  
**GRAND THEME:** “INNOVATION FOR A BETTER FUTURE”  
**SUB-TEMA:** “Building Intelligent AI Agents for Enterprise Productivity”  
**FOKUS INDUSTRI:** Enterprise & Industry (AI Recruitment Agent)  

---

## IDENTITAS KARYA DAN TIM PENGEMBANG

* **Judul Karya:**  
  **TalentOps AI : Sistem Rekrutmen Mandiri Berbasis Kecerdasan Buatan**
* **Nama Tim:** Doa Ibu  
* **Asal Instansi:** Universitas Jenderal Soedirman (UNSOED)  
* **Susunan Tim Pengembang:**
  1. **Adridinan Najmi Faza** (Ketua Tim / H1D025059)
  2. **Timotius Willy Narendra** (Anggota 1 / H1D025052)
  3. **Fardizza Vinda Rahman** (Anggota 2 / H1D025067)
* **Tautan Sistem & Repositori:**
  * **Live Interface Web:** `https://talentops.ai.id/`
  * **Repositori GitHub Publik:** `https://github.com/najmifaza/TalentOpsAI`
  * **Video Demo (3–5 menit):** `-`
* **Format Pengumpulan Berkas:** `GTNIC2026_AIAgent_DoaIbu.pdf`  
* **Standar Tipografi Dokumen:** Kertas A4, Times New Roman 12 pt, Spasi 1.5, Margin Kiri 4 cm, Atas/Bawah/Kanan 3 cm, Maksimal 15 Halaman (termasuk Sampul Berlogo Resmi GTNIC 2026).

---

# STRUKTUR MASTER PROPOSAL (SESUAI GUIDEBOOK GTNIC 2026)

---

## 1. JUDUL KARYA DAN IDENTITAS TIM
* **Judul:** TalentOps AI : Sistem Rekrutmen Mandiri Berbasis Kecerdasan Buatan
* **Tim:** Doa Ibu (Universitas Jenderal Soedirman)
* **Ketua Tim:** Adridinan Najmi Faza (NIM: H1D025059)
* **Anggota:** Timotius Willy Narendra (NIM: H1D025052), Fardizza Vinda Rahman (NIM: H1D025067)
* **Penempatan Logo:** Logo Resmi GARDA TECH NATIONAL INNOVATION COMPETITION (GTNIC) 2026 dan Logo Universitas tersemat pada halaman sampul utama.

---

## 2. LATAR BELAKANG MASALAH OPERASIONAL ENTERPRISE & INDUSTRI

### 2.1. Ledakan Volume Pelamar & Krisis Kelelahan Kognitif HR
Dalam operasional rekrutmen enterprise skala menengah hingga besar, pembukaan satu posisi strategis (misalnya *Senior Backend Engineer* atau *Financial Analyst*) lazim menerima 250 hingga 500 berkas Curriculum Vitae (CV) dalam hitungan hari. Berdasarkan studi operasional industri, seorang spesialis *Talent Acquisition* rata-rata menghabiskan waktu 6 hingga 10 menit untuk meninjau satu CV secara manual. Untuk memproses 500 berkas, dibutuhkan lebih dari 65 jam kerja intensif. Situasi ini secara tak terhindarkan memicu *cognitive fatigue* (kelelahan kognitif), di mana ketelitian manusia menurun drastis setelah meninjau berkas ke-30, sehingga membuka peluang terjadinya lolosnya klaim palsu atau penolakan sepihak terhadap kandidat yang sebenarnya berkualifikasi tinggi.

### 2.2. Kegagalan Generasi ATS Konvensional (Keyword Matching)
Sistem *Applicant Tracking System* (ATS) konvensional yang beredar di industri saat ini masih mengandalkan pencocokan kata kunci statis (*syntactic keyword matching*). Kelemahan fatal dari pendekatan ini adalah kerentanannya terhadap eksploitasi *keyword stuffing* dan peretasan teks putih (*white font text hacking*), di mana pelamar menyisipkan kata kunci tersembunyi dengan warna teks putih agar lolos penyaringan mesin. Sebaliknya, kandidat kompeten yang menggunakan sinonim atau variasi bahasa alami sering kali langsung tereliminasi secara tidak adil.

### 2.3. Bahaya Integrasi "Thin Wrapper" LLM Tanpa Landasan Bukti
Ketika banyak organisasi berupaya mengadopsi kecerdasan buatan generatif, sebagian besar solusi yang dikembangkan hanya berupa *thin wrapper* di atas antarmuka obrolan (chat prompt). Pendekatan naif ini membawa tiga risiko destruktif bagi enterprise:
1. **Halusinasi Data & Aritmatika:** LLM sering kali mengarang tahun pengalaman, salah menjumlahkan durasi kerja, atau memberikan skor numerik yang tidak konsisten antarsesinya.
2. **Ketiadaan Bukti (Lack of Evidence Traceability):** HR hanya menerima skor tanpa kemampuan menelusuri dari mana skor tersebut diperoleh (*black-box reasoning*).
3. **Pelanggaran Kepatuhan & Privasi (UU PDP / GDPR):** Pengunggahan berkas CV mentah berisikan data pribadi (PII) sensitif seperti nomor KTP/telepon/alamat ke API publik melanggar prinsip perlindungan privasi enterprise.

---

## 3. TUJUAN, MANFAAT, DAN SOLUSI OTOMATISASI AI AGENT

### 3.1. Tujuan Pengembangan
1. Mengembangkan agen otonom cerdas (*Autonomous AI Agent*) yang mampu mengeksekusi siklus investigasi rekrutmen berantai (*Understand -> Sanitize -> Investigate -> Trace Evidence -> Score -> Challenge -> Schedule -> HITL Gatekeeper*) secara mandiri.
2. Memisahkan secara tegas antara **penalaran probabilitis LLM** (konteks, klasifikasi klaim, sintesis soal) dengan **eksekusi deterministik backend** (kalkulasi skor matematis, transaksi database ACID, proteksi bentrok kalender).
3. Menjamin transparansi keputusan 100% melalui *Candidate Evidence Graph*, di mana setiap poin penilaian terhubung langsung ke kutipan teks dokumen primer (*ground-truth citation*).
4. Menerapkan perlindungan data tingkat enterprise berbasis *AES-256-GCM Envelope Encryption* dan pemusnahan kunci kriptografis (*Crypto-Shredding*) demi kepatuhan UU PDP dan GDPR.

### 3.2. Manfaat Nyata bagi Industri & Nilai Bisnis
* **Peningkatan Efisiensi Waktu 97.5%:** Memangkas durasi peninjauan awal per berkas dari 480 detik (8 menit) manual menjadi hanya **12 detik** di panel tinjau HR, dengan latensi pemrosesan agen di balik layar rata-rata **7.84 detik**.
* **Eliminasi Kesalahan Fatal (Zero Bad-Hire Risk from Overlaps):** Deteksi otomatis pemalsuan riwayat karier seperti tumpang tindih tanggal kerja (*timeline overlap*) dan inflasi jabatan (*title inflation*).
* **Efisiensi Anggaran Wawancara:** Mengeliminasi pemborosan waktu pewawancara teknis (*engineering leads*) dengan menyaring kandidat sebelum tahap wawancara langsung melalui *Adaptive Gap-Based Technical Challenge*.
* **Mitigasi Risiko Hukum Privasi:** Enterprise terbebas dari ancaman sanksi kebocoran data pelamar kerja melalui isolasi PII dan otomatisasi *Right to Erasure*.

---

## 4. TARGET PERUSAHAAN DAN PENGGUNA INDUSTRI

1. **Enterprise & Perusahaan Teknologi Berskala Menengah-Besar:** Menghadapi rasio ratusan pelamar per posisi dengan kebutuhan standar verifikasi teknis yang ketat.
2. **Divisi Talent Acquisition (TA) & Human Resource Operation:** Pengguna primer yang mengendalikan alur kerja seleksi, meninjau hasil investigasi agen, dan melakukan konfirmasi keputusan akhir (*Human-in-the-Loop*).
3. **VP of Engineering & Hiring Managers:** Pengguna teknis yang memanfaatkan *Candidate Evidence Graph* dan asesmen adaptif untuk memverifikasi kedalaman kompetensi kandidat tanpa perlu membaca tumpukan berkas CV 10 halaman.
4. **HR Compliance & Legal Data Protection Officers (DPO):** Pengawas kepatuhan yang memerlukan bukti audit langkah agen (*immutable audit logs*) dan kepatuhan penghapusan data privasi.
5. **Kandidat / Pelamar Publik:** Memperoleh keadilan evaluasi meritokratis tersamar (*blind evaluation*) dan transparansi status seleksi melalui token pelacakan rahasia (*Tracking Token*).

---

## 5. ARSITEKTUR SISTEM AI DAN REKAYASA PERANGKAT LUNAK

TalentOps AI dibangun dengan arsitektur **3-Tier Enterprise** yang memisahkan lapisan klien, mesin orkestrasi agen, basis data relasional MariaDB 14 tabel normalisasi (dengan audit append-only), dan gateway inferensi AI:

```
[PRESENTATION & INTERACTION TIER]
React 18 + Vite 5 + Tailwind CSS (Natural Mint Theme) + Lucide Icons + SSE Client
- Fitur UI: Candidate Triage Kanban, Interactive Evidence Graph, What-If Policy Canvas,
            Real-Time Agent Execution Trace Feed, Public Career & Tracking Portal,
            Admin Blog CMS, dan Role-Based Access Control Login Gate
- Host: Production Domain `https://talentops.ai.id` / Vercel Edge Network

                        | HTTPS REST API (JSON) + Authenticated SSE Stream Ticket
                        v

[AGENT CORE & DETERMINISTIC ENGINE TIER]
Python 3.12 + FastAPI Core (Async) + Pydantic v2 + Cryptography Engine + aiomysql
- Ingestion & Security Filter: PII Sanitizer & PDF Hidden Text Exploit Detector
- Cryptographic Privacy: AES-256-GCM Envelope Encryption (DEK/KEK) + Blind Indexing
- Identity Security: Single-Use Burn-on-Read Ticket untuk Streaming Real-Time SSE
- Autonomous Agent State Machine (ReAct Cycle Orchestration):
  [Understand] -> [Sanitize PII] -> [Investigate Claims] -> [Trace Evidence] ->
  [4D Deterministic Score] -> [Generate Adaptive Challenge] -> [Atomic Schedule]
- Bounded Self-Healing Circuit:
  * Exponential Backoff Retry (<= 3) untuk Transient Timeout/Deadlock
  * Dynamic Conflict Recovery (HTTP 409) pada bentrok kalender
- Host: Ubuntu VPS, Nginx Reverse Proxy (SSL Let's Encrypt, HTTP/2, Gzip)

        | Local TCP Socket (Port 20128) | aiomysql Async Connection Pool
        v                               v

[AI INFERENCE GATEWAY]          [DATA PERSISTENCE & AUDIT TIER]
9Router API Gateway             MariaDB 10.11+ Enterprise RDBMS (InnoDB 3NF)
Model: Gemini 3.8 / 3.7 Flash   14 Tabel Relasional Normalisasi Penuh:
- Strict JSON Schema Output     - RBAC Users, OAuth Tokens, Consent Records
- Multi-turn Function Calling   - Candidates, Evidence, Anomalies, Assessments
- Zero Arithmetic Hallucination - Interview Slots (Locking), Scorecards, Reviews
- Deterministic Temperature 0.2 - Agent Steps, PII Access Logs, Blog Posts
```

### 5.1. Alur Logika State Machine & Tool Calling (Rubrik GTNIC 25% + 15% + 15%)
Agen tidak mengeksekusi instruksi linier buta, melainkan bekerja melalui **Agentic State Machine** berbasis siklus *Reasoning + Acting (ReAct)*:
1. **Tool `extract_and_sanitize_resume`:** Mengekstrak teks dari berkas PDF, memindai injeksi teks tersembunyi, dan mengaburkan PII nama/email/telepon menjadi identitas anonim `#TK-[6-HEX]`.
2. **Tool `investigate_claims_and_evidence`:** Mengidentifikasi klaim pengalaman dan keahlian, memvalidasi bukti primer (nomor halaman berkas, tautan GitHub riil), dan mencatat kontribusi skor ke tabel `candidate_evidence`.
3. **Tool `audit_career_timeline`:** Menganalisis rentang bulan dan tahun kerja. Jika terdeteksi tumpang tindih (>3 bulan tanpa status freelance) atau lonjakan level jabatan fiktif, anomali dicatat ke tabel `candidate_anomalies`.
4. **Deterministic Math Scoring Engine:** Skor akhir 4 dimensi (Skill 40%, Experience 30%, Education 10%, Portfolio 20%) dihitung murni oleh algoritma deterministik Python, **bukan oleh LLM**, sehingga keabsahan matematis terjamin 100%.
5. **Tool `generate_adaptive_challenge`:** Menganalisis kesenjangan (*skill gap*) kandidat dan menghasilkan 1 skenario studi kasus teknis berbobot spesifik (Tingkat L1/L2/L3) ke tabel `candidate_assessments`.
6. **Tool `reserve_interview_slot`:** Menemukan slot kalender kosong dan menguncinya secara atomik (`status = 'tentative'`).
7. **Human-in-the-Loop Triaging:** Berkas diarahkan ke antrean `waiting_approval` bagi HR untuk persetujuan akhir.

### 5.2. Skema Basis Data Relasional 14 Tabel (Kualitas Rekayasa Sistem 15%)
Implementasi basis data MariaDB InnoDB 3NF menjamin *data integrity* dan auditabilitas menyeluruh:
1. `users`: Manajemen pengguna dan otentikasi RBAC (`admin`, `recruiter`, `hiring_manager`, `compliance_officer`) berbasis hash PBKDF2-HMAC-SHA256 (100.000 iterasi, salt per pengguna) dengan proteksi brute-force (kunci 15 menit setelah 5 kali gagal).
2. `oauth_tokens`: Kredensial integrasi kalender terenkripsi (Google Calendar / Mock Calendar).
3. `job_descriptions`: Definisi kualifikasi, bobot 4 dimensi, dan taksonomi peran (*Universal Domain IT vs Non-IT* via Migrasi 007).
4. `candidates`: Master data kandidat dengan enkripsi amplop (*Envelope Encryption* AES-256-GCM), DEK terenkripsi KEK, *Blind Index* email, identitas tersamar `#TK-[6-HEX]`, dan status siklus hidup.
5. `consent_records`: Rekam jejak persetujuan pemrosesan data pribadi (UU PDP) dengan bukti hash dan user agent.
6. `candidate_evidence`: Relasi penelusuran bukti atomik (*Evidence Graph*) yang memuat kutipan klaim, sumber bukti dokumen, dan badge verifikasi.
7. `candidate_anomalies`: Catatan anomali investigasi timeline, manipulasi visual/teks putih, tingkat keparahan (*severity*), dan rekomendasi verifikasi manual.
8. `candidate_assessments`: Soal studi kasus adaptif kustom per kandidat berbasis celah kompetensi (L1/L2/L3).
9. `interview_slots`: Slot jadwal pewawancara dengan proteksi *atomic row-level locking* (`SELECT ... FOR UPDATE`) dan `lock_version`.
10. `interview_scorecards`: Lembar evaluasi pewawancara terstruktur pasca-wawancara (Migrasi 008).
11. `agent_steps`: Audit trail langkah siklus penalaran agen (durasi, payload masukan terisolasi, luaran, status pemulihan).
12. `human_reviews`: Rekam persetujuan peninjau manusia (Keputusan: `APPROVED_DISPATCH`, `REQUEST_INFO`, `OVERRIDE_REJECT`, `REJECT_CONFIRMED`, `RESUBMIT` via Migrasi 009).
13. `pii_access_logs`: Log audit unmasking data pelamar (siapa yang mengakses nama/email asli, alasan, dan alamat IP).
14. `blog_posts`: Modul konten publik dan informasi portal karier (Migrasi 006).

---

## 6. FITUR UTAMA AI AGENT & METRIK ESTIMASI EFISIENSI OPERASIONAL (ROI)

### 6.1. Fitur Utama Sistem
1. **Autonomous Evidence-Based Investigation:** Ekstraksi klaim berbasis bukti riil dengan penelusuran kutipan halaman berkas dan repositori GitHub.
2. **Interactive Candidate Evidence Graph:** Visualisasi simpul interaktif yang menghubungkan skor evaluasi dengan bukti otentik (*ground-truth*).
3. **Career Timeline & Anomaly Auditor:** Algoritma deterministik pencegah kecurangan masa kerja dan inflasi gelar secara otomatis.
4. **Adaptive Gap-Based Technical Challenge:** Sintesis studi kasus terarah untuk menguji keabsahan klaim kompetensi kandidat.
5. **"What-If?" Policy Simulator:** Alat simulasi kontrafaktual instan bagi eksekutif untuk melihat dampak pengubahan syarat rekrutmen terhadap ukuran talent pool dan beban kerja tim HR.
6. **Bounded Self-Healing Circuit:** Kemampuan pulih mandiri saat terjadi gangguan jaringan atau tabrakan slot kalender tanpa memutus pipeline.
7. **Human-in-the-Loop (HITL) Triaging Gatekeeper:** Menjamin AI tidak pernah membuat keputusan pemecatan/penolakan sepihak; kendali final tetap di tangan manusia.

### 6.2. Metrik Efisiensi Operasional & Estimasi ROI Bisnis

| Parameter Metrik | Operasional Konvensional (Manual) | Dengan TalentOps AI | Dampak Efisiensi (ROI) |
|---|---|---|---|
| **Waktu Skrining Awal per CV** | 480 detik (8 menit) | **12 detik** (Review Ringkasan Agen) | **Efisiensi Waktu 97.5%** |
| **Throughput Peninjauan 500 CV** | 66.7 jam kerja (8.3 hari kerja) | **1.6 jam kerja total** | Menghemat 65.1 jam kerja HR |
| **Biaya Skrining Awal (500 CV)** | Rp 6.670.000,- (@ Rp 100rb/jam) | Rp 160.000,- (Biaya token & server) | **Penghematan Biaya 97.6%** |
| **Tingkat Human Error & Bias** | Tinggi (Terutama setelah berkas ke-30) | Mendekati 0% (Investigasi Tersamar & Standar Baku) | Peningkatan integritas rekrutmen |
| **Latensi Pemrosesan Agen** | Manual | **7.84 detik** per kandidat | Pemrosesan background asinkron |
| **Resilience Kalender (Race Condition)** | Rawan *double-booking* jadwal | 100% Bebas Bentrok (Atomic Row-Locking) | Nol bentrok jadwal wawancara |

---

## 7. BATASAN SISTEM DAN MITIGASI RISIKO

### 7.1. Mitigasi Halusinasi AI & Inkonsistensi Skor (Zero Hallucination Guarantee)
* **Kalkulasi Deterministik:** Model LLM secara tegas dilarang melakukan perhitungan matematika skor atau penentuan status akhir. LLM hanya mengklasifikasikan bukti ke dalam format JSON Pydantic yang divalidasi ketat (*Strict Schema Enforcement*).
* **Pencocokan Bobot Deterministik:** Formula skor $\sum (w_i 	imes s_i)$ dihitung langsung oleh fungsi matematika Python di backend, mengeliminasi variansi penilaian antarwaktu.

### 7.2. Perlindungan Privasi Data & Anti-Kebocoran PII (UU PDP / GDPR Compliance)
* **AES-256-GCM Envelope Encryption:** Setiap berkas dan data identitas kandidat dienkripsi menggunakan *Data Encryption Key* (DEK) unik per kandidat. DEK tersebut dienkripsi ulang menggunakan *Master Key Encryption Key* (KEK) tingkat sistem.
* **Blind Indexing (SHA-256 with Salt):** Pencarian kandidat via email dilakukan melalui hash blind index tanpa pernah mendekripsi data kolom email di basis data.
* **Crypto-Shredding pada Right to Erasure:** Apabila kandidat mengajukan penghapusan data sesuai UU PDP, sistem memusnahkan DEK kandidat tersebut. Sekalipun data terenkripsi masih berada di media backup fisik, data tersebut secara matematis mustahil didekripsi kembali.

### 7.3. Mitigasi Eksploitasi Teks Tersembunyi (White Text & Prompt Injection)
* Modul `hidden_text_detector` memeriksa lapisan visual PDF untuk mendeteksi teks dengan ukuran font mendekati 0 atau warna font identik dengan warna latar belakang (*white text on white background*). Berkas yang terindikasi manipulasi diberi penanda anomali beresiko tinggi (*HIGH severity*).

### 7.4. Bounded Self-Healing & Fallback Recovery
* Jika API inferensi LLM mengalami *rate limit* atau *transient timeout*, sirkuit pemulihan mengeksekusi *exponential backoff retry* maksimal 3 kali.
* Jika slot kalender wawancara yang ditargetkan telah dipesan transaksi lain (`HTTP 409 Conflict`), agen secara otomatis melakukan query ulang slot alternatif berikutnya tanpa menggagalkan proses triase.

---

## 8. TANGKAPAN LAYAR ANTARMUKA DAN INTERAKSI AI AGENT

Desain antarmuka mengusung filosofi **Natural Mint Theme** yang ergonomis, kontras tinggi, dan berorientasi pada kemudahan navigasi pengguna industri:

1. **Dashboard Triase Utama (Candidate Kanban & Overview Metrics):**  
   Menampilkan KPI rekrutmen, grafik distribusi skor 4 dimensi, status antrean pemrosesan, dan daftar kandidat terbagi atas *High Attention* vs *Standard*.
2. **Modal Interaktif Candidate Evidence Graph:**  
   Menampilkan visualisasi simpul (*nodes & edges*) yang menghubungkan skor akhir kandidat ke setiap butir bukti riil di dokumen CV dan repositori eksternal, lengkap dengan nomor halaman dan badge verifikasi.
3. **Execution Trace & Tool Calling Feed (Real-Time SSE):**  
   Panel interaksi transparan yang menyajikan jejak penalaran agen (*ReAct thoughts*), pemanggilan alat (*tool calling parameter*), dan status pemulihan sistem secara waktu nyata.
4. **"What-If?" Policy Simulation Matrix:**  
   Kanvas interaktif dengan tuas geser (*dynamic sliders*) untuk menguji sensitivitas ambang skor dan memproyeksikan rasio kelulusan kandidat secara instan.
5. **Portal Karir Publik & Applicant Tracking (`/careers` & `/careers/track`):**  
   Antarmuka publik yang bersih bagi pelamar kerja luar untuk melamar posisi dan memantau status secara mandiri menggunakan *tracking token* rahasia.

---

## 9. RENCANA PENGEMBANGAN LANJUTAN (FUTURE DEVELOPMENT)

1. **Multi-Agent Collaborative Interview Panel:** Menghadirkan beberapa agen AI dengan spesialisasi berbeda (*Architecture Agent, Culture-Fit Agent, Security Auditor Agent*) untuk melakukan penilaian multi-perspektif secara konsensus.
2. **Autonomous Multi-Calendar Real-Time Sync:** Memperluas integrasi kalender langsung ke ekosistem Microsoft Outlook 365 dan Calendly Enterprise API dengan deteksi ketersediaan antar-zona waktu global.
3. **Internal Talent Mobility & Succession Forecasting:** Memanfaatkan *Evidence Graph* untuk memetakan jalur karier internal karyawan di dalam organisasi serta memprediksi kebutuhan talenta masa depan berbasis analisis tren proyek.
4. **Enterprise Multi-Tenant SaaS Isolation:** Skalabilitas skema basis data dari *Single Default Tenant* menuju isolasi skema per-perusahaan (*Tenant Schema Separation*) dengan kepatuhan sertifikasi SOC2 Type II dan ISO 27001.

---

## 10. BLUEPRINT PENGUJIAN VIDEO DEMO (3–5 MENIT)

Struktur naratif video demonstrasi sistem (sesuai ketentuan silabus GTNIC 2026):

* **Menit 00:00 - 00:45 (Pitching Masalah Industri):**  
  Pembukaan masalah 500 CV yang memicu kelelahan HR. Kontras antara ATS konvensional yang rapuh dengan TalentOps AI sebagai *Autonomous Recruitment Operating System*.
* **Menit 00:45 - 01:45 (Demo Live Kasus 1: Budi Santoso - Strong Match):**  
  Unggah CV -> Agen mengeksekusi ekstraksi dan sanitasi PII -> Verifikasi bukti proyek backend -> Kalkulasi skor deterministik 92.4 -> Pemesanan slot kalender sementara -> Rekomendasi `STRONG MATCH`.
* **Menit 01:45 - 02:45 (Demo Live Kasus 2: Reza Pratama - Deteksi Anomali & Self-Healing):**  
  Agen mengeksekusi *Career Timeline Auditor* -> Menemukan anomali tumpang tindih masa kerja 17 bulan -> Penjelasan visual pada *Evidence Graph* -> Pembuatan asesmen adaptif -> Uji coba bentrok kalender HTTP 409 -> Agen memulihkan diri (*RECOVERED*) memilih slot baru secara otonom.
* **Menit 02:45 - 03:45 (Demo Live Kasus 3: Simulasi Kebijakan "What-If"):**  
  HR mendemonstrasikan pengubahan parameter kualifikasi -> Mesin simulasi memproyeksikan perubahan metrik talent pool secara seketika -> Eksekusi persetujuan manusia (*Human-in-the-Loop*).
* **Menit 03:45 - 04:30 (Penjelasan Arsitektur di Balik Layar & Penutup):**  
  Tinjauan ringkas arsitektur 3-tier, pemisahan LLM vs Deterministic, enkripsi kriptografis, dan komitmen etika rekrutmen masa depan.
