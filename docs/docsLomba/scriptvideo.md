# NASKAH VIDEO DEMO & PITCHING PRODUK
## GARDA TECH NATIONAL INNOVATION COMPETITION (GTNIC) 2026
**Kategori:** AI Agent Development  
**Judul Karya:** TalentOps AI : Sistem Rekrutmen Mandiri Berbasis Kecerdasan Buatan  
**Nama Tim:** Tim Doa Ibu (Universitas Jenderal Soedirman)  
**Anggota Tim:**
1. Timotius Willy Narendra (H1D025052) – Frontend & UI/UX Specialist
2. Adridinan Najmi Faza (H1D025059) – Backend, Security & Cloud Architect
3. Fardizza Vinda Rahman (H1D025067) – AI Agent Logic & Evaluation Engineer

**Estimasi Durasi:** 04:10 – 04:30 Menit (Standar Guidebook: 3 – 5 Menit)  
**Tautan Platform:** `https://talentops.ai.id`  
**Unggah:** YouTube publik atau Google Drive akses publik, tautan dicantumkan di Google Form pengumpulan.

---

### PEDOMAN SUARA & GAYA BICARA (ANTI-AI SLOP)
- **Gaya Bahasa:** Percakapan natural anak teknik yang sedang mendemokan karya nyata. Kalimat pendek, jelas, tidak berbunga-bunga, artikulasi mantap.
- **Frasa AI yang Dibuang:** 
  - *"Ekosistem mutakhir"*, *"transparansi adalah kunci"*, *"mari kita uji langsung"*, *"inilah bukti nyata"*, *"menjembatani kesenjangan"*, *"peran krusial"*.
- **Aturan Bukti:** setiap klaim yang keluar dari mulut narator harus terlihat di layar pada detik yang sama. Kalau tidak bisa ditunjukkan, jangan diucapkan.
- **Fokus Utama:** tunjukkan aksi nyata di layar, sebutkan masalah lapangan apa adanya, dan tegaskan bedanya agen berbasis bukti dengan chatbot wrapper.

---

### RINGKASAN STRUKTUR VIDEO
1. **Bagian 1 (00:00 - 00:55):** Perkenalan tim, masalah industri, dan solusi yang ditawarkan.
2. **Bagian 2 (00:55 - 01:35):** Demo sisi pelamar — portal lowongan, sanitasi PII, tracking token rahasia.
3. **Bagian 3 (01:35 - 02:20):** Demo sisi perekrut — triage otonom, skor 4D, jadwal wawancara terkunci, simulasi wawancara.
4. **Bagian 4 (02:20 - 03:05):** Kasus curang: kerja bertumpuk, klaim pengalaman mengarang, manipulasi berkas.
5. **Bagian 5 (03:05 - 03:40):** Bukti dan kejujuran sistem — evidence graph, jalur non-IT, audit bahasa lowongan.
6. **Bagian 6 (03:40 - 04:10):** Arsitektur teknis di balik layar.
7. **Bagian 7 (04:10 - 04:30):** Metrik efisiensi, nilai bisnis, penutup.

---

## TABEL NASKAH LENGKAP (SCENE BY SCENE)

| Waktu | Visual & Aksi Layar | Audio / Narasi Voiceover | On-Screen Text (OST) & Grafik |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:25** | Bumper pembuka GTNIC 2026 & Unsoed. Split-screen 3 anggota Tim Doa Ibu dengan webcam jernih, lalu transisi ke landing page `https://talentops.ai.id`. | "Halo dewan juri GTNIC 2026. Kami Tim Doa Ibu dari Universitas Jenderal Soedirman. Dan ini TalentOps AI, sistem rekrutmen mandiri berbasis kecerdasan buatan." | **TalentOps AI**<br>Tim Doa Ibu (Unsoed)<br>AI Agent Development |
| **00:25 - 00:55** | Scroll landing page. Overlay grafis: tumpukan CV, rasio pelamar per posisi, teks UU PDP No. 27/2022 dan UU Ketenagakerjaan No. 13/2003. | "Dua masalah utama rekrutmen teknologi. Pertama, satu posisi bisa menerima ratusan CV, dan setelah berkas ke-30 ketelitian penyaring manusia turun. Kedua, ATS lama hanya mencocokkan kata kunci, sehingga bisa ditipu teks putih dan kandidat bagus dengan istilah berbeda ikut tersingkir. Kami tidak membuat chatbot obrolan. Kami membuat agen yang menilai kandidat dari bukti yang bisa diperiksa ulang." | **Problem Industri:**<br>• Ratusan CV per posisi, ketelitian turun<br>• ATS kata kunci mudah ditipu<br>• Risiko kepatuhan UU PDP No. 27/2022 |
| **00:55 - 01:20** | **Demo Pelamar:** buka portal lowongan, pilih *Senior Backend Engineer*, klik *Lamar*, unggah `cv_01_backend_strong.pdf`. Sorot panel hasil sanitasi PII yang muncul. | "Kita mulai dari sisi pelamar. Pelamar memilih posisi lalu mengunggah berkas. Perhatikan: berkas tidak langsung dikirim mentah ke model AI. Modul sanitasi menyensor nama, kontak, jenis kelamin, dan nama kampus lebih dulu, sesuai UU PDP. Jadi agen menilai rekam jejak kerja, bukan identitas." | **1. Sanitasi PII In-Memory**<br>Nama, kontak, kampus disensor sebelum dianalisis |
| **01:20 - 01:35** | Modal sukses muncul dengan *Secret Tracking Token*. Kursor copy token, buka halaman lacak, paste token, tampil status berkas. | "Pelamar menerima kode pelacakan unik. Lewat halaman lacak mandiri, status berkas bisa dipantau kapan saja tanpa membuka data pribadi siapa pun." | **2. Secret Tracking Token**<br>Pelacakan mandiri tanpa membuka PII |
| **01:35 - 02:00** | **Demo Perekrut:** pindah ke dashboard admin. Kandidat baru muncul di tabel, klik *Jalankan Analisis AI*, panel trace berjalan. Sorot hasil: skor, rekomendasi STRONG_MATCH, dan status slot wawancara terkunci. | "Sekarang sisi perekrut. Agen berjalan sendiri: sanitasi, pemeriksaan berkas, ekstraksi klaim, audit bukti, lalu perhitungan skor. Skornya bukan karangan model, tapi aritmetika deterministik empat dimensi. Kandidat ini mendapat rekomendasi STRONG_MATCH, dan sistem sudah mengunci satu slot wawancara untuknya." | **3. Skoring 4D Deterministik**<br>Keahlian • Pengalaman • Pendidikan • Portofolio<br>**Slot wawancara terkunci otomatis** |
| **02:00 - 02:20** | Klik tab **Simulasi Wawancara AI**. Sorot 3 pertanyaan beserta badge tingkat kesulitan dan kriteria penilaian. Scroll satu kartu untuk memperlihatkan pertanyaan lanjutan. | "Pertanyaan wawancara di sini bukan daftar generik. Agen menyusunnya dari bukti kandidat ini sendiri, dan setiap keahlian yang belum terverifikasi mendapat penelusuran lebih dalam. Perekrut tinggal memakai atau menyesuaikannya." | **4. Simulasi Wawancara Adaptif**<br>Pertanyaan lahir dari bukti kandidat |
| **02:20 - 02:40** | Unggah `cv_02_backend_overlap.pdf` ke lowongan yang sama. Buka dossier kandidat, sorot anomali **kerja bertumpuk 24 bulan** beserta kedua peran dan periodenya. | "Sekarang kita uji dengan berkas yang bermasalah. Kandidat kedua mencantumkan dua pekerjaan penuh waktu yang berjalan bersamaan selama 24 bulan. Sistem menghitung rentang tanggal, menemukan tumpang tindihnya, dan menandai risikonya tinggi. Dua nama perusahaan dan periodenya ikut ditampilkan supaya perekrut bisa langsung menanyakan." | **Anomali: CONCURRENT_FULLTIME_OVERLAP**<br>Dua peran penuh waktu, 24 bulan bersamaan |
| **02:40 - 02:55** | Unggah `cv_04_backend_experience_inflation.pdf`. Tampilkan anomali **inflasi klaim pengalaman**: CV menyebut 8 tahun, rentang tanggal hanya sekitar 1,4 tahun. | "Berkas ketiga menulis delapan tahun pengalaman di ringkasan profil. Rentang tanggal yang bisa dibaca hanya sekitar satu setengah tahun. Sistem membandingkan keduanya dan menolak menganggap klaim itu sebagai fakta." | **Anomali: EXPERIENCE_CLAIM_INFLATION**<br>Klaim 8 tahun vs riwayat ±1,4 tahun |
| **02:55 - 03:05** | Unggah `cv_07_backend_prompt_injection.pdf`. Tampilkan halaman berkas asli (teks putih terlihat lewat seleksi) lalu dossier: status karantina keamanan, prioritas HIGH_ATTENTION. | "Berkas terakhir membawa perintah tersembunyi: teks putih dan teks mode tak terlihat yang menyuruh model memberi skor 100. Berkas itu tidak dinilai sama sekali. Statusnya karantina keamanan, dan wajib diperiksa manual sebelum lanjut." | **SECURITY QUARANTINE**<br>Teks putih + teks tak terlihat terdeteksi |
| **03:05 - 03:25** | Buka tab **Penelusuran Bukti CV** (Evidence Graph). Klik satu simpul keahlian, sorot kutipan kalimat asli CV dan status verifikasi. Buka **Agent Trace**, sorot chip konsensus dua model. | "Setiap angka bisa ditelusuri. Simpul keahlian terhubung ke kutipan kalimat asli di CV, bukan ringkasan buatan model. Dan pada tahap ekstraksi, dua model membaca berkas yang sama secara terpisah. Kalau keduanya berbeda jauh, sistem menurunkan tingkat keyakinannya sendiri dan mengalihkan berkas ke pemeriksaan manusia." | **Evidence Graph**<br>Setiap skor menunjuk kutipan asli<br>**Konsensus Dua Model** |
| **03:25 - 03:40** | Pindah ke portal publik, buka detail lowongan. Sorot badge **Inklusivitas** beserta jumlah temuan. Lalu unggah `cv_11_tax_accounting.pdf` ke lowongan non-IT dan sorot langkah verifikasi GitHub yang dilewati adaptif. | "Sistem juga memeriksa bahasa lowongan itu sendiri. Istilah yang diskriminatif seperti batas usia atau almamater ditandai, dan skor inklusivitasnya tampil di portal publik. Untuk posisi non-teknis seperti pajak atau hukum, agen tidak memaksa memeriksa repositori kode, tapi tetap menelusuri bukti dokumen." | **Audit Bahasa Lowongan**<br>Skor inklusivitas tampil publik<br>**Jalur Non-IT** tanpa penalti portofolio |
| **03:40 - 04:10** | Tampilan diagram arsitektur. Sorot berurutan: pipeline tujuh tahap, dua pemeriksaan silang, MariaDB, enkripsi AES-256-GCM, dan tabel audit langkah agen. | "Di balik layar, agen bekerja dalam tujuh tahap yang berurutan dan tercatat. Setiap tahap menyimpan masukan, luaran, dan durasinya sendiri, sehingga alurnya bisa diperiksa ulang. Setelah penilaian, ada dua pemeriksaan silang: konsensus dua model dan penyaring keluaran yang menahan teks yang tidak pantas. Data kandidat dienkripsi dengan AES-256-GCM, dan permintaan penghapusan data benar-benar memusnahkan kunci dekripsinya." | **Arsitektur & Kepatuhan:**<br>• Pipeline 7 tahap + audit trail<br>• Enkripsi AES-256-GCM (crypto-shredding)<br>• MariaDB InnoDB |
| **04:10 - 04:30** | Infografis metrik: waktu skrining manual 8 menit per CV menjadi belasan detik di panel perekrut; berkas yang butuh perhatian naik ke atas antrean. Kembali ke webcam 3 anggota tim untuk penutup. | "Hasilnya, peninjauan awal per berkas yang tadinya sekitar delapan menit turun jadi belasan detik di panel perekrut, tanpa menghilangkan kendali manusia. Keputusan akhir tetap di tangan perekrut. Kami Tim Doa Ibu, terima kasih." | **Dampak:**<br>• Peninjauan awal 8 menit → belasan detik<br>• Kendali akhir tetap pada manusia |

---

## PETUNJUK TEKNIS PRODUKSI & RECORDING VIDEO

1. **Pengaturan Format Rekaman:**
   - **Rasio:** 16:9 Landscape (1920x1080, 30fps atau 60fps) untuk visual web dan diagram arsitektur.
   - **Audio:** narasi jernih tanpa gema, background music instrumen korporat volume rendah (-24 dB).
   - **Zoom browser:** 100–110%. Pastikan teks tabel kandidat, chip konsensus, dan kartu pertanyaan wawancara terbaca jelas pada 1080p.
2. **Kesesuaian dengan 4 Poin Utama Guidebook GTNIC 2026:**
   - Perkenalan anggota tim: detik 00:00 - 00:25.
   - Penjelasan masalah industri & solusi AI: detik 00:25 - 00:55.
   - Demo interaktif AI Agent live: detik 00:55 - 03:40.
   - Cara kerja arsitektur AI di balik layar: detik 03:40 - 04:10.
3. **Persiapan Sebelum Rekaman (lakukan H-1):**
   - [ ] Pastikan backend aktif (`https://api.talentops.ai.id`) dan API key gateway LLM valid — tanpa key, triage gagal dengan 401.
   - [ ] Unggah dan triage ulang `cv_01_backend_strong.pdf` lebih dulu agar ada kandidat `STRONG_MATCH` dengan slot wawancara terkunci saat rekaman.
   - [ ] Jalankan `POST /api/jobs/{id}/analyze-bias` untuk kelima lowongan agar badge inklusivitas di portal publik tidak berbunyi "Belum diaudit".
   - [ ] Siapkan keenam berkas dari `docs/docsLomba/demo_cv/` sesuai urutan scene.
   - [ ] Bersihkan antrean kandidat bekas percobaan supaya tabel tidak penuh berkas uji.
4. **Urutan Berkas Demo:**

| Berkas | Momen di video | Hasil yang harus terlihat |
|---|---|---|
| `cv_01_backend_strong.pdf` | 00:55 | `STRONG_MATCH`, slot wawancara terkunci, tab Simulasi Wawancara terisi |
| `cv_02_backend_overlap.pdf` | 02:20 | Anomali kerja bertumpuk 24 bulan (risiko HIGH) |
| `cv_04_backend_experience_inflation.pdf` | 02:40 | Anomali inflasi klaim pengalaman (8 tahun vs ±1,4 tahun) |
| `cv_07_backend_prompt_injection.pdf` | 02:55 | Karantina keamanan, prioritas HIGH_ATTENTION |
| `cv_11_tax_accounting.pdf` | 03:25 | Jalur non-IT: audit GitHub dilewati adaptif |
| `cv_09_backend_duplicate.pdf` | opsional (cadangan) | Ditandai berkas duplikat berikut nomor dossier asalnya |

5. **Catatan Risiko Saat Rekaman:**
   - Bila `cv_01` tertandai `LOW_CONFIDENCE_EXTRACTION` (dua model berbeda bacaan), ulangi triase sekali lagi. Bila tetap muncul, jadikan itu momen jujur: "sistem menurunkan keyakinannya sendiri dan meminta manusia memeriksa".
   - Jangan menampilkan kredensial, alamat database, atau token pada rekaman.
   - Rekam dalam satu take per bagian, potong di titik transisi agar tidak ada downtime menunggu proses.
