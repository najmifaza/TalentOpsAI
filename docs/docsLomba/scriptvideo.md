# NASKAH VIDEO DEMO & PITCHING PRODUK
## GARDA TECH NATIONAL INNOVATION COMPETITION (GTNIC) 2026
**Kategori:** AI Agent Development  
**Judul Karya:** TalentOps AI : Human-Centric Agentic Recruitment Web Ecosystem  
**Nama Tim:** Tim Doa Ibu (Universitas Jenderal Soedirman)  
**Anggota Tim:**
1. Timotius Willy Narendra (H1D025052) – Frontend & UI/UX Specialist
2. Adridinan Najmi Faza (H1D025059) – Backend, Security & Cloud Architect
3. Fardizza Vinda Rahman (H1D025067) – AI Agent Logic & Evaluation Engineer

**Estimasi Durasi:** 03:30 – 03:45 Menit (Standar Guidebook: 3 – 5 Menit)  
**Tautan Platform:** `https://talentops.ai.id`

---

### PEDOMAN SUARA & GAYA BICARA (ANTI-AI SLOP)
- **Gaya Bahasa:** Percakapan natural anak teknik yang sedang mendemokan karya nyata. Kalimat pendek, jelas, tidak berbunga-bunga, artikulasi mantap.
- **Frasa AI yang Dibuang:** 
  - *"Ekosistem mutakhir"*, *"transparansi adalah kunci"*, *"mari kita uji langsung"*, *"inilah bukti nyata"*, *"menjembatani kesenjangan"*, *"peran krusial"*.
- **Fokus Utama:** Tunjukkan aksi nyata di layar, sebutkan masalah lapangan apa adanya, dan tegaskan perbedaan agen deterministik vs chatbot wrapper biasa.

---

### RINGKASAN STRUKTUR VIDEO
1. **Bagian 1 (00:00 - 00:35):** Perkenalan Tim, Pitching Latar Belakang Masalah & Solusi AI.
2. **Bagian 2 (00:35 - 01:30):** Demo Interaktif Sisi Pelamar (Sanitasi PII In-Memory & Tracking Token).
3. **Bagian 3 (01:30 - 02:45):** Demo Interaktif Sisi Perekrut & Otonomi Agen (4D Deterministic Scoring, GitHub API Tool Calling, Human-in-the-Loop).
4. **Bagian 4 (02:45 - 03:25):** Arsitektur Teknis Sistem di Balik Layar (Pipeline Reasoning, Enkripsi AES-256-GCM, Audit Trail).
5. **Bagian 5 (03:25 - 03:50):** Metrik Efisiensi Operasional, Nilai Bisnis & Penutup.

---

## TABEL NASKAH LENGKAP (SCENE BY SCENE)

| Waktu | Visual & Aksi Layar | Audio / Narasi Voiceover | On-Screen Text (OST) & Grafik |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:20** | Bumper pembuka singkat GTNIC 2026 & Unsoed. Split-screen menampilkan 3 anggota Tim Doa Ibu dengan webcam jernih, lalu transisi ke landing page `https://talentops.ai.id`. | "Halo dewan juri GTNIC 2026. Kami dari Tim Doa Ibu, Universitas Jenderal Soedirman. Dan ini adalah TalentOps AI." | **TalentOps AI**<br>Tim Doa Ibu (Unsoed)<br>AI Agent Development |
| **00:20 - 00:45** | Kursor scroll landing page. Muncul overlay grafis sederhana: tumpukan 500 CV vs waktu screening, teks UU PDP No. 27/2022. | "Problem rekrutmen teknologi saat ini ada dua: pertama, tim HR kewalahan menyaring ratusan CV, ujung-ujungnya seleksi sering bias ke almamater atau nama. Kedua, banyak sistem ATS yang tidak aman dan rawan melanggar UU Perlindungan Data Pribadi. Kami tidak membuat chatbot obrolan, melainkan sistem agen mandiri yang menyaring kandidat berdasarkan bukti teknis riil." | **Problem Industri:**<br>• Ratusan CV menumpuk & bias seleksi<br>• Risiko kepatuhan UU PDP No. 27/2022 |
| **00:45 - 01:20** | **Demo Pelamar:**<br>Buka portal lowongan `/lowongan`, pilih *Senior Backend Engineer*, klik *Lamar*. Upload file resume PDF dummy. | "Kita lihat alurnya dari sisi pelamar. Pelamar masuk ke portal terbuka, pilih posisi, lalu unggah berkas resume. Nah, perhatikan di sini: begitu berkas masuk, pipeline kami tidak langsung melempar data mentah ke model AI. Modul sanitasi in-memory langsung menyensor nama, nomor kontak, foto, dan kampus sebelum dianalisis. Jadi agen murni menilai rekam jejak kerja dan skill." | **1. Sanitasi PII In-Memory**<br>Nama, kontak, kampus disensor instan |
| **01:20 - 01:45** | Modal sukses muncul, menampilkan *Secret Tracking Token*. Kursor copy token, lalu klik menu `/track` dan paste token untuk melihat status berkas. | "Pelamar langsung mendapat Secret Tracking Token unik. Lewat halaman lacak mandiri, pelamar bisa memantau proses berkasnya secara transparan tanpa khawatir data pribadi mereka disalahgunakan." | **2. Secret Tracking Token**<br>Pelacakan transparan & aman |
| **01:45 - 02:20** | **Demo Recruiter:**<br>Pindah layar ke Recruiter Dashboard (`/admin`). Tabel pelamar langsung ter-update, klik salah satu kandidat. Tampilkan hasil triage <= 15 detik. | "Sekarang kita pindah ke dashboard recruiter. Di sini agen AI bekerja otomatis dalam waktu kurang dari 15 detik per berkas. Penilaiannya bukan tebak-tebakan bahasa, tapi kalkulasi deterministik 4 dimensi: kecocokan skill, masa kerja tanpa tumpang tindih, jenjang pendidikan, dan bukti portofolio." | **3. Skoring 4D Deterministik**<br>Skill • Pengalaman Valid • Edukasi • Bukti Riil |
| **02:20 - 02:45** | Klik tab *Evidence Graph* dan pop-up *GitHub API Check*. Sorot panggilan REST API ke profil GitHub pelamar. | "Kalau kandidat mencantumkan akun GitHub, agen kami menggunakan tool calling untuk langsung mengecek ke GitHub REST API. Apakah repositorinya aktif? Bahasa kodenya sesuai? Commit-nya riil atau cuma fork kosong? Ini yang membuat penilaian kami bebas halusinasi." | **4. Tool Calling Aktif**<br>Verifikasi data riil via GitHub REST API v3 |
| **02:45 - 03:10** | Klik tombol *Trace Reason*, muncul panel runtutan berpikir agen (Chain of Thought). Kursor mengarah ke tombol keputusan akhir: *Approve / Reject / Schedule Interview*. Recruiter menekan *Approve*. | "Transparansi juga penting. Recruiter bisa membaca runtutan logika agen di panel trace reason ini. Tapi yang paling krusial: agen tidak pernah membuat keputusan tolak atau terima secara sepihak. Keputusan final tetap 100 persen di tangan recruiter manusia. Inilah prinsip Human-in-the-Loop." | **5. Human-in-the-Loop (HITL)**<br>AI menganalisis, manusia penentu mutlak |
| **03:10 - 03:30** | Tampilan diagram arsitektur sistem (`System Architecture`). Sorot box FastAPI, PostgreSQL, modul Enkripsi AES-256-GCM, dan log audit trail ISO 27001. | "Di balik layar, sistem kami dibangun dengan FastAPI dan PostgreSQL. Seluruh data kandidat dienkripsi dengan envelope AES-256-GCM, dilengkapi audit trail berstandar ISO 27001, dan isolasi tenant ketat agar patuh penuh terhadap regulasi privasi." | **Arsitektur & Kepatuhan:**<br>• Enkripsi AES-256-GCM<br>• Audit Trail ISO 27001 & UU PDP |
| **03:30 - 03:45** | Infografis ringkas metrik: pangkas waktu 80%, triage <= 15 detik. Kembali ke webcam 3 anggota tim untuk closing pitch. | "Hasilnya, TalentOps AI memangkas 80 persen waktu skrining manual HR, menghilangkan bias subjektif, dan melindungi privasi pelamar secara hukum. Kami Tim Doa Ibu, terima kasih!" | **Dampak Nyata:**<br>• Waktu HR terpangkas hingga 80%<br>• Screening akurat, adil & patuh hukum |

---

## PETUNJUK TEKNIS PRODUKSI & RECORDING VIDEO

1. **Pengaturan Format Rekaman:**
   - **Rasio:** 16:9 Landscape (Resolusi 1920x1080p, 60fps / 30fps jernih) untuk visual web dan presentasi arsitektur.
   - **Audio:** Suara narasi jernih tanpa gema/noise (gunakan noise suppression), background music instrumen korporat teknologi dengan volume rendah (-24 dB).
2. **Kesesuaian dengan 4 Poin Utama Guidebook GTNIC 2026:**
   - Perkenalan anggota tim: Tertera di detik 00:00 - 00:15.
   - Penjelasan masalah industri & solusi AI: Tertera di detik 00:15 - 00:35.
   - Walkthrough demo interaktif AI Agent live: Tertera di detik 00:35 - 02:45.
   - Cara kerja arsitektur AI di balik layar: Tertera di detik 02:45 - 03:25.
3. **Checklist Demo Layar:**
   - [ ] Buka live site `https://talentops.ai.id`.
   - [ ] Siapkan 1 file sample resume (PDF) untuk upload demo.
   - [ ] Buka dashboard admin/triage rekruter untuk menunjukkan panel evidence graph dan trace reasoning.
