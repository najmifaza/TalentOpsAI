# NASKAH VIDEO DEMO & PITCHING PRODUK
## GARDA TECH NATIONAL INNOVATION COMPETITION (GTNIC) 2026
**Kategori:** AI Agent Development  
**Judul Karya:** TalentOps AI : Sistem Rekrutmen Mandiri Berbasis Kecerdasan Buatan  
**Nama Tim:** Tim Doa Ibu (Universitas Jenderal Soedirman)  
**Anggota Tim:**
1. Timotius Willy Narendra (H1D025052), Frontend & UI/UX Specialist
2. Adridinan Najmi Faza (H1D025059), Backend, Security & Cloud Architect
3. Fardizza Vinda Rahman (H1D025067), AI Agent Logic & Evaluation Engineer

**Estimasi Durasi:** 04:38 (Standar Guidebook: 3-5 Menit)  
**Tautan Platform:** `https://talentops.ai.id`  
**Unggah:** YouTube publik atau Google Drive akses publik, tautan dicantumkan di Google Form pengumpulan.

---

### TIGA JENIS ASET VIDEO (JANGAN DICAMPUR SAAT EDITING)
| Kode | Aset | Status | Cara bikin |
| :--- | :--- | :--- | :--- |
| **[OPEN]** | Rekaman opening bertiga | **Sudah direkam** | Footage kamera/webcam, tidak dinarasikan ulang |
| **[DECK]** | Slide pitch deck + voiceover | Belum dibuat | Deck 16:9, VO direkam terpisah lalu ditempel ke slide |
| **[SCREEN]** | Screen record aplikasi | Belum direkam | OBS/recorder, 1080p, rasio 16:9, kursor disembunyikan saat membaca |
| **[CLOSE]** | Rekaman closing bertiga | **Sudah direkam** | Footage kamera/webcam, tidak dinarasikan ulang |

Kalimat yang **diucapkan di layar kosong / di luar aplikasi** masuk ke **[DECK]**. Kalimat yang
menjelaskan aksi di layar aplikasi masuk ke **[SCREEN]**. Jangan taruh narasi problem di atas
screen record aplikasi: tidak ada yang bisa ditunjuk di layar saat itu.

---

### PEDOMAN SUARA & GAYA BICARA (ANTI-AI SLOP)
- **Gaya Bahasa:** Percakapan natural anak teknik yang sedang mendemokan karya nyata. Kalimat pendek, jelas, tidak berbunga-bunga, artikulasi mantap.
- **Frasa AI yang Dibuang:** 
  - *"Ekosistem mutakhir"*, *"transparansi adalah kunci"*, *"mari kita uji langsung"*, *"inilah bukti nyata"*, *"menjembatani kesenjangan"*, *"peran krusial"*.
- **Aturan Bukti:** setiap klaim yang keluar dari mulut narator harus terlihat di layar pada detik yang sama. Kalau tidak bisa ditunjukkan, taruh di slide **[DECK]**, jangan di atas **[SCREEN]**.
- **Fokus Utama:** tunjukkan aksi nyata di layar, sebutkan masalah lapangan apa adanya, dan tegaskan bedanya agen berbasis bukti dengan chatbot wrapper.

---

### RINGKASAN STRUKTUR VIDEO
1. **Bagian 1 (00:00 - 01:05):** [OPEN] perkenalan tim, lanjut [DECK] masalah lapangan dan posisi produk.
2. **Bagian 2 (01:05 - 01:42):** [SCREEN] sisi pelamar: portal lowongan, sanitasi PII, tracking token rahasia.
3. **Bagian 3 (01:42 - 02:20):** [SCREEN] sisi perekrut: triage otonom pada berkas bersih, skor 4D, jadwal wawancara terkunci, simulasi wawancara.
4. **Bagian 4 (02:20 - 03:20):** [SCREEN] satu berkas curang, enam temuan sekaligus: karantina keamanan, kerja bertumpuk, inflasi klaim, inflasi jabatan, jeda karier, berkas duplikat.
5. **Bagian 5 (03:18 - 03:38):** [SCREEN] bukti dan kejujuran sistem: evidence graph, konsensus dua model, audit bahasa lowongan.
6. **Bagian 6 (03:38 - 04:08):** [DECK] arsitektur teknis di balik layar.
7. **Bagian 7 (04:08 - 04:23):** [DECK] metrik efisiensi dan nilai bisnis.
8. **Bagian 8 (04:23 - 04:38):** [CLOSE] penutup bertiga dan tagline.

**Berkas yang diunggah saat screen record: 2.** `cv_01_backend_strong.pdf` (bersih) dan
`cv_14_backend_multi_anomali.pdf` (berkas curang berlapis). Kasus duplikat dipicu dengan
mengunggah ulang berkas yang sama, bukan dengan berkas baru.

---

### DAFTAR SLIDE PITCH DECK
Aset: `docs/docsLomba/pitch_deck/TalentOps_PitchDeck.html` (presentasi, navigasi panah kiri/kanan)
dan `docs/docsLomba/pitch_deck/TalentOps_PitchDeck.pdf` (6 halaman 16:9, siap direkam atau dicetak).

Enam slide, teks di layar pendek, sisanya voiceover. Angka yang disebut wajib ada di slide.

| Slide | Isi | Dipakai di detik |
| :--- | :--- | :--- |
| **S1 · Judul** | TalentOps AI · Tim Doa Ibu (Unsoed) · AI Agent Development | 00:00 (bumper setelah [OPEN]) |
| **S2 · Masalah** | Empat kartu: CV manual 480 detik dan 500 berkas = 66,7 jam kerja · akurasi turun setelah berkas ke-30 · berkas mudah direkayasa (tumpang tindih, jabatan naik, teks sewarna latar) · identitas vs kompetensi menurut UU PDP No. 27/2022 | 00:22 - 00:52 |
| **S3 · Posisi produk** | Chatbot jawab pertanyaan. Ini menilai berkas, menyimpan bukti, dan berhenti di persetujuan HR. | 00:52 - 01:05 |
| **S4 · Arsitektur** | Pipeline 8 tahap + audit trail langkah · skor 4 dimensi (40/30/10/20) · penyaring keluaran · AES-256-GCM (crypto-shredding) · MariaDB InnoDB | 03:38 - 04:08 |
| **S5 · Dampak** | Peninjauan awal 480 detik (8 menit) → 12 detik per berkas (efisiensi 97,5%) · 500 CV: 66,7 jam → 1,6 jam · latensi agen 7,84 detik · keputusan akhir di perekrut | 04:08 - 04:23 |
| **S6 · Tagline** | TalentOps hadir untuk menilai kandidat dari bukti, bukan dari kata kunci. | 04:23 - 04:38 (jembatan ke [CLOSE]) |

---

## TABEL NASKAH LENGKAP (SCENE BY SCENE)

| Waktu | Aset | Visual & Aksi Layar | Audio / Narasi | On-Screen Text (OST) |
| :--- | :--- | :--- | :--- | :--- |
| **00:00 - 00:22** | **[OPEN]** | Rekaman bertiga yang sudah ada. Potong jadi 22 detik, sisipkan bumper GTNIC 2026 & Unsoed di awal, lalu title card S1 di akhir klip. | *Sudah direkam, jangan dinarasikan ulang.* Isi: perkenalan tim Doa Ibu, "kami sudah membuat TalentOps AI", dan "setelah ini kami akan pitching produk yang sudah kami buat". | **TalentOps AI**<br>Tim Doa Ibu (Unsoed)<br>AI Agent Development |
| **00:22 - 00:52** | **[DECK]** | S2 · Masalah. Empat kartu 2x2 muncul berurutan: volume, mutu keputusan, integritas berkas, data pribadi. Grafis kecil: tumpukan CV dan jam kerja. | "Ada empat masalah. Satu, membaca satu CV manual makan 480 detik, delapan menit. Untuk 500 berkas, 66,7 jam kerja. Dua, setelah berkas ke-30 perhatian peninjau habis, kriteria antar orang juga beda, jadi CV bagus bisa kelewat. Tiga, berkasnya gampang direkayasa: tanggal tumpang tindih, jabatan dinaikkan, teks sewarna latar, sampai instruksi tersembunyi ke model. Manual nyaris tidak bisa menangkapnya konsisten di ratusan berkas. Empat, data pelamar wajib dipisah dari penilaian kompetensi, itu amanat UU PDP No. 27/2022. Dan chatbot cuma memindahkan kerja baca ke mesin, skornya tidak bisa diperiksa." | **Problem Manual:**<br>• CV manual 480 detik, 500 berkas = 66,7 jam kerja<br>• Akurasi turun setelah berkas ke-30<br>• Berkas mudah direkayasa<br>• UU PDP No. 27/2022, UU No. 13/2003 |
| **00:52 - 01:05** | **[DECK]** | S3 · Posisi produk. Teks pendek, lalu transisi ke layar aplikasi (masuk [SCREEN]). | "Bedanya sama chatbot: chatbot menjawab pertanyaan soal CV. Yang kami bangun menilai berkasnya, dan menyimpan buktinya. Sekarang kami buka sistemnya." | **Bukan chatbot wrapper**<br>Agen berbasis bukti |
| **01:05 - 01:30** | **[SCREEN]** | **Demo Pelamar:** buka portal lowongan, pilih *Senior Backend Engineer*, klik *Lamar*, unggah `cv_01_backend_strong.pdf`. Sorot panel hasil sanitasi PII yang muncul. | "Kita mulai dari pelamar. Dia pilih posisi, lalu unggah CV. CV-nya tidak langsung masuk ke model. Ada modul sanitasi yang menyensor nama, kontak, jenis kelamin, dan nama kampus dulu, sesuai UU PDP. Jadi yang dinilai rekam jejaknya, bukan identitasnya." | **1. Sanitasi PII In-Memory**<br>Nama, kontak, kampus disensor sebelum dianalisis |
| **01:30 - 01:42** | **[SCREEN]** | Modal sukses muncul dengan *Secret Tracking Token*. Kursor copy token, buka halaman lacak, paste token, tampil status berkas. | "Dia dapat kode lacak unik. Lewat halaman lacak, status berkasnya bisa dicek kapan saja, tanpa bisa melihat data pribadi siapa pun." | **2. Secret Tracking Token**<br>Pelacakan mandiri tanpa membuka PII |
| **01:42 - 02:05** | **[SCREEN]** | **Demo Perekrut:** pindah ke dashboard admin. Kandidat `cv_01` muncul di tabel, klik *Jalankan Analisis AI*, panel trace berjalan. Sorot hasil: skor, rekomendasi STRONG_MATCH, dan status slot wawancara terkunci. | "Pindah ke sisi perekrut. Berkas pelamar tadi sudah selesai diproses: sanitasi, cek berkas, ambil klaim, audit bukti, sampai skor. Skornya dihitung rumus empat dimensi, jadi angkanya bisa dicek ulang. Kandidat ini dapat STRONG_MATCH, dan sistem sudah mengunci satu slot wawancara buat dia." | **3. Skoring 4D Deterministik**<br>Keahlian • Pengalaman • Pendidikan • Portofolio<br>**Slot wawancara terkunci otomatis** |
| **02:05 - 02:20** | **[SCREEN]** | Klik tab **Simulasi Wawancara AI**. Sorot 3 pertanyaan beserta badge tingkat kesulitan dan kriteria penilaian. Scroll satu kartu untuk memperlihatkan pertanyaan lanjutan. | "Pertanyaan wawancaranya disusun dari CV kandidat ini sendiri. Keahlian yang belum terbukti bikin pertanyaannya lebih dalam. Perekrut tinggal pakai, atau ubah kalau perlu." | **4. Simulasi Wawancara Adaptif**<br>Pertanyaan lahir dari bukti kandidat |
| **02:20 - 02:45** | **[SCREEN]** | Unggah `cv_14_backend_multi_anomali.pdf` ke lowongan yang sama. Dossier terbuka: sorot daftar temuan berurutan. Kursor berhenti di **CONCURRENT_FULLTIME_OVERLAP 24 bulan**, lalu sorot kedua peran dan periodenya. | "Sekarang kita unggah berkas yang isinya bermasalah. Dari satu berkas ini saja, sistem mengeluarkan enam temuan, dan masing-masing bisa dibuka. Yang pertama: dua pekerjaan penuh waktu jalan bersamaan selama 24 bulan. Rentang tanggalnya dihitung, tumpang tindihnya ketemu, lalu nama kedua perusahaan dan periodenya ditampilkan, jadi perekrut tahu apa yang harus ditanyakan." | **1 unggahan, 6 temuan**<br>**CONCURRENT_FULLTIME_OVERLAP 24 bulan**<br>Dua peran penuh waktu, bersamaan |
| **02:45 - 03:03** | **[SCREEN]** | Scroll daftar temuan: **inflasi klaim pengalaman** (profil menyebut 8 tahun, rentang tanggal terbaca 2,9 tahun), lalu **inflasi jabatan** (Staf ke Manager dalam 2 bulan), lalu **jeda karier 13 bulan**. Sorot badge risiko dan verdict. | "Yang kedua, di ringkasan CV-nya tertulis delapan tahun pengalaman. Rentang tanggal yang bisa dibaca cuma dua koma sembilan tahun, jadi klaim delapan tahunnya tidak dianggap fakta. Yang ketiga, naik dari staf ke manager dalam dua bulan. Yang keempat, ada jeda tiga belas bulan di riwayat kerjanya. Jeda itu bukan pelanggaran, jadi bobotnya ringan, perekrut cuma dapat konteks. Hasil akhirnya REVIEW_REQUIRED, prioritas HIGH_ATTENTION." | **EXPERIENCE_CLAIM_INFLATION**<br>Klaim 8 tahun vs riwayat 2,9 tahun<br>**TITLE_INFLATION_DETECTED**<br>Staf → Manager dalam 2 bulan<br>**CAREER_BREAK_FLAG** (informasi, bukan penalti) |
| **03:03 - 03:18** | **[SCREEN]** | Buka berkas asli di viewer PDF, blok area atas halaman pertama sampai teks putih terlihat lewat seleksi. Balik ke dossier: status karantina keamanan. Lalu unggah ulang berkas yang sama dan sorot penanda duplikat. | "Terakhir, berkasnya menyimpan perintah tersembunyi. Ada teks putih dan teks mode tak terlihat yang menyuruh model memberi skor seratus. Itu ketangkap di lapisan berkas, sebelum isi CV-nya dipercaya. Statusnya karantina keamanan. Lalu berkas yang sama kami unggah lagi, dan hash-nya cocok dengan yang pertama. Langsung ditandai duplikat, sekalian disebut nomor dossier asalnya." | **SECURITY QUARANTINE**<br>Teks putih + teks tak terlihat terdeteksi<br>**DUPLICATE_RESUME_UPLOAD**<br>Hash SHA-256 sama dengan dossier asal |
| **03:18 - 03:38** | **[SCREEN]** | Buka tab **Penelusuran Bukti CV** (Evidence Graph) pada dossier `cv_01`. Klik satu simpul keahlian, sorot kutipan kalimat asli CV dan status verifikasi. Buka **Agent Trace**, sorot chip konsensus dua model. Lalu pindah ke portal publik dan sorot badge inklusivitas pada detail lowongan. | "Setiap angka bisa ditelusuri. Klik satu keahlian, yang muncul kalimat asli dari CV kandidat, jadi bukan ringkasan buatan model. Di tahap ekstraksi, dua model membaca berkas yang sama secara terpisah. Kalau bacaan mereka jauh beda, sistem menurunkan keyakinannya sendiri dan melempar berkasnya ke pemeriksaan manusia. Sistem juga mengaudit bahasa lowongannya: kata yang diskriminatif seperti batas usia atau almamater ditandai, dan skor inklusivitasnya tampil di portal publik." | **Evidence Graph**<br>Setiap skor menunjuk kutipan asli<br>**Konsensus Dua Model**<br>**Audit Bahasa Lowongan** |
| **03:38 - 04:08** | **[DECK]** | S4 · Arsitektur. Tampilkan diagram arsitektur (atau salinan potongan diagram `arsitektur_sistem_talentops.png`) dan sorot berurutan: delapan tahap (sensor PII, uji integritas berkas, analisis riwayat, pencocokan kutipan, verifikasi portofolio, skor 4 dimensi, konsensus dan soal wawancara, keputusan dan slot), lalu penyaring keluaran, AES-256-GCM, dan tabel audit langkah agen. | "Di balik layar, agen bekerja dalam delapan tahap berurutan, dari sensor data pribadi sampai penguncian slot wawancara. Tiap tahap dicatat: masukan, luaran, dan durasinya. Jadi kalau hasilnya dipertanyakan, alurnya bisa dibuka ulang. Dua model juga membaca terpisah, dan keluaran sistem lewat penyaring sebelum tampil. Data kandidat dienkripsi dengan AES-256-GCM. Kalau pelamar minta datanya dihapus, kunci dekripsinya dimusnahkan, jadi datanya tidak bisa dibaca lagi." | **Arsitektur & Kepatuhan:**<br>• Pipeline 8 tahap + audit trail<br>• Skor 4D 40/30/10/20, dihitung Python<br>• AES-256-GCM (crypto-shredding)<br>• MariaDB InnoDB |
| **04:08 - 04:23** | **[DECK]** | S5 · Dampak. Dua angka besar berdampingan: 480 detik (8 menit) manual vs 12 detik di panel perekrut, plus catatan efisiensi 97,5% dan latensi agen 7,84 detik. Sorot kalimat terakhir soal keputusan di perekrut. | "Hasilnya, peninjauan awal satu CV yang manualnya 480 detik, atau delapan menit, di panel perekrut jadi 12 detik. Proses di latar belakang rata-rata 7,84 detik per kandidat, atau efisiensi 97,5 persen. Untuk 500 berkas, 66,7 jam kerja jadi 1,6 jam. Berkas yang bermasalah naik ke atas antrean, biar cepat dilihat manusia. Tapi keputusan akhirnya tetap di perekrut." | **Dampak:**<br>• 480 detik → 12 detik per CV (efisiensi 97,5%)<br>• 500 CV: 66,7 jam → 1,6 jam<br>• Latensi agen 7,84 detik<br>• Kendali akhir pada manusia |
| **04:23 - 04:38** | **[CLOSE]** | Rekaman bertiga yang sudah ada. Tempel title card S6 sebelum klip masuk, potong pas dengan ucapan terima kasih. | *Sudah direkam, jangan dinarasikan ulang.* Isi: terima kasih kepada dewan juri, lalu "TalentOps hadir untuk menilai kandidat dari bukti, bukan dari kata kunci." | **TalentOps hadir untuk menilai kandidat dari bukti, bukan dari kata kunci.** |

---

## PETUNJUK TEKNIS PRODUKSI

1. **Pengaturan Format Rekaman [SCREEN]:**
   - **Rasio:** 16:9 (1920x1080, 30fps atau 60fps). Rekam aplikasi satu kali penuh, potong per bagian saat editing.
   - **Zoom browser:** 100-110%. Pastikan teks tabel kandidat, chip konsensus, dan kartu pertanyaan wawancara terbaca jelas pada 1080p.
   - **Kursor:** gunakan kursor besar yang mudah dilihat; jangan digerakkan saat narasi sedang menjelaskan angka.
2. **Pengaturan [DECK]:**
   - Deck 16:9, latar gelap atau putih konsisten, satu gagasan per slide, teks maksimal 12 kata per baris.
   - Rekam voiceover terpisah (bukan suara ruangan) supaya bisa dipotong mengikuti durasi slide.
   - Durasi slide mengikuti tabel di atas; S2 (30 detik) dan S3 (13 detik) gabungan 43 detik. Ini bagian terpadat, jangan dipanjangkan lagi.
   - Narasi S2 sudah dipangkas ke 88 kata, tempo normal 2,9 kata per detik. Kalau latihan lisan masih lewat 30 detik, potong dulu kalimat "Manual nyaris tidak bisa menangkapnya konsisten di ratusan berkas", jangan potong angkanya.
3. **Audio keseluruhan:** narration jernih tanpa gema, background music instrumen korporat volume rendah (-24 dB). Samakan level suara antara footage [OPEN]/[CLOSE] dan voiceover [DECK]/[SCREEN] sebelum ekspor final.
4. **Kesesuaian dengan 4 Poin Utama Guidebook GTNIC 2026:**
   - Perkenalan anggota tim: detik 00:00 - 00:22 ([OPEN]).
   - Penjelasan masalah industri & solusi AI: detik 00:22 - 01:05 ([DECK] S2-S3).
   - Demo interaktif AI Agent live: detik 01:05 - 03:38 ([SCREEN]).
   - Cara kerja arsitektur AI di balik layar: detik 03:38 - 04:08 ([DECK] S4).
5. **Persiapan Sebelum Rekaman [SCREEN] (lakukan H-1):**
   - [ ] Pastikan backend aktif (`https://api.talentops.ai.id`) dan API key gateway LLM valid. Tanpa key, triage gagal dengan 401.
   - [ ] Unggah dan triage ulang `cv_01_backend_strong.pdf` lebih dulu agar ada kandidat `STRONG_MATCH` dengan slot wawancara terkunci saat rekaman.
   - [ ] Jalankan `POST /api/jobs/{id}/analyze-bias` untuk kelima lowongan agar badge inklusivitas di portal publik tidak berbunyi "Belum diaudit".
   - [ ] Siapkan kedua berkas dari `docs/docsLomba/demo_cv/`: `cv_01_backend_strong.pdf` dan `cv_14_backend_multi_anomali.pdf`.
   - [ ] Bersihkan antrean kandidat bekas percobaan supaya tabel tidak penuh berkas uji.
6. **Urutan Berkas Demo:**

| Urutan | Berkas | Momen di video | Hasil yang harus terlihat |
|---|---|---|---|
| 1 | `cv_01_backend_strong.pdf` | 01:05 | `STRONG_MATCH`, slot wawancara terkunci, tab Simulasi Wawancara terisi |
| 2 | `cv_14_backend_multi_anomali.pdf` | 02:20 | Enam temuan dari satu unggahan: `SECURITY_QUARANTINE_PROMPT_INJECTION`, `CONCURRENT_FULLTIME_OVERLAP` 24 bulan, `TITLE_INFLATION_DETECTED`, `CAREER_BREAK_FLAG`, `EXPERIENCE_CLAIM_INFLATION` (8 tahun vs 2,9 tahun) → `REVIEW_REQUIRED`, prioritas `HIGH_ATTENTION` |
| 3 | `cv_14_backend_multi_anomali.pdf` (unggah ulang) | 03:03 | `DUPLICATE_RESUME_UPLOAD` berikut nomor dossier asalnya |

Berkas `cv_14` sudah memicu dua temuan lapisan keamanan sekaligus: teks putih (`PDF_WHITE_TEXT`)
dan teks tak terlihat (`PDF_INVISIBLE_RENDER_MODE`). Tidak perlu berkas tambahan untuk itu.

7. **Catatan Risiko Saat Rekaman:**
   - Bila `cv_01` tertandai `LOW_CONFIDENCE_EXTRACTION` (dua model berbeda bacaan), ulangi triase sekali lagi. Bila tetap muncul, jadikan itu momen jujur: "sistem menurunkan keyakinannya sendiri dan meminta manusia memeriksa".
   - Jangan menunggu `cv_14` mendapat slot wawancara atau verdict selain `REVIEW_REQUIRED`. Berkas berstatus karantina tidak pernah lanjut otomatis, jadi slot wawancara selalu diperagakan pada `cv_01` dan urutan scene tidak boleh dibalik.
   - Jangan menampilkan kredensial, alamat database, atau token pada rekaman.
   - Rekam [SCREEN] dalam satu take per bagian, potong di titik transisi agar tidak ada downtime menunggu proses.
   - Karena berkas karantina tidak pernah dipakai untuk mengunci jadwal, urutan scene `cv_01` lebih dulu wajib dipertahankan.
