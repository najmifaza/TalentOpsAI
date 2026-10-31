# AUDIT SCORING ENGINE REPORT (TASK 1)
**Target Berkas**: `backend/app/core/scoring.py` & `backend/tests/test_scoring_engine.py`  
**Metodologi**: Code audit statis, audit formulasi matematis, boundary & edge case analysis, normalisasi bobot, dan mitigasi bias penilaian.

---

### 1. Ringkasan Eksekutif
Audit dilakukan terhadap komponen penentu skor deterministik 4-Dimensi:
- $S_{comp}$ (Skills Coverage & Taxonomy)
- $S_{exp}$ (Experience Piecewise Linear)
- $S_{edu}$ (Education Scalar)
- $S_{port}$ (Portfolio Verification)
- Agregasi Skor Akhir ($S_{overall}$), Evaluasi Risiko, Level Konfidensi, dan Matriks Triage.

Secara umum struktur evaluasi sudah deterministik dan modular. Namun ditemukan sejumlah celah kritis terkait normalisasi bobot dinamis, potensi zero division/inbound zero error, asimetri relasi taksonomi, bias deteksi tumpang tindih waktu, serta coverage test suite yang belum menguji skenario batas (edge cases).

---

### 2. Temuan Kritis & Celah Matematis

#### A. Zero Division & Normalisasi Bobot Dinamis (`compute_full_assessment`)
- **Lokasi**: `backend/app/core/scoring.py:790-811`
- **Kode**:
  ```python
  total_w = sum(w.values()) if w else 1.0
  if total_w > 0:
      w_norm = {k: v / total_w for k, v in w.items()}
  else:
      w_norm = cls.DEFAULT_WEIGHTS
  ```
- **Masalah & Celah**:
  1. Jika caller mengirimkan dictionary bobot kosong `{}` atau dictionary dengan nilai 0 untuk semua dimensi (misal: `{"SKILL": 0, "EXPERIENCE": 0, "EDUCATION": 0, "PORTFOLIO": 0}`), kondisi `total_w > 0` bernilai `False` dan fallback ke `DEFAULT_WEIGHTS`.
  2. Namun, jika caller memberikan bobot dengan nilai negatif atau float invalid (misal total bobot bernilai negatif, atau nilai NaN), normalisasi bobot menghasilkan rasio yang mendistorsi rentang skor [0, 100].
  3. Jika dictionary bobot hanya mengirim sebagian dimensi (misal hanya `{"SKILL": 1.0}`), pembagian menghasilkan `w_norm = {"SKILL": 1.0}` sementara key dimensi lain (`EXPERIENCE`, `EDUCATION`, `PORTFOLIO`) menghasilkan `None` atau `0.0` melalui `.get(k, 0.4)`. Perhatikan baris:
     ```python
     overall = (
         (skill_score * w_norm.get("SKILL", 0.4))
         + (exp_score * w_norm.get("EXPERIENCE", 0.3))
         + (edu_score * w_norm.get("EDUCATION", 0.1))
         + (port_score * w_norm.get("PORTFOLIO", 0.2))
     )
     ```
     Jika `w_norm` tidak memiliki key `EXPERIENCE`, method `.get("EXPERIENCE", 0.3)` akan mengambil default fallback `0.3`, sehingga total bobot melebihi 1.0 ($1.0 + 0.3 + 0.1 + 0.2 = 1.6$). Hal ini menyebabkan overall score terdistorsi dan melebihi 100 sebelum di-clamp.

#### B. Asimetri & Celah Pencocokan Taksonomi (`calculate_relevance` & `SKILL_TAXONOMY_MAP`)
- **Lokasi**: `backend/app/core/scoring.py:8-21, 88-128`
- **Masalah & Celah**:
  1. **Asimetri Taksonomi Statis**: `SKILL_TAXONOMY_MAP` berbasis key requirement.
     - Contoh: Jika requirement `"fastapi"`, kandidat mencantumkan `"python"`, skor relevansi = 0.7 (`"python" in SKILL_TAXONOMY_MAP["fastapi"]`).
     - Namun jika requirement `"python"`, `SKILL_TAXONOMY_MAP["python"]` berisi `{"fastapi", ...}`.
     - Untuk pasangan lain seperti `"go"`: `SKILL_TAXONOMY_MAP["go"] = {"golang", "rust"}`. Tetapi jika requirement adalah `"rust"`, tidak ada key `"rust"` di map. Akibatnya kandidat dengan skill `"go"` mendapat relevansi `0.0` jika posisi membutuhkan `"rust"`.
  2. **Substring Subversion pada `_has_term`**:
     Fungsi `_has_term` memakai regex boundary `(?<![a-z0-9+#.]){re.escape(term)}(?![a-z0-9+#.])`.
     Untuk term yang sangat pendek seperti `"c"`, jika requirement adalah `"c"`, teks kandidat berisi huruf tunggal atau ekspresi berpotensi salah tangkap (false match).
  3. **Penalti Arbitrer 0.7 vs 1.0**:
     Tidak ada diferensiasi tingkat kedekatan relasi: framework sejenis (Django vs FastAPI) disamakan bobotnya dengan bahasa pemrograman (Python vs FastAPI) sebesar 0.7.

#### C. Edge Case Perhitungan Pengalaman & Interval Merging (`merge_employment_intervals`)
- **Lokasi**: `backend/app/core/scoring.py:161-273`
- **Masalah & Celah**:
  1. **Perhitungan Bulan Inklusif `(end - start + 1)`**:
     Satu periode kerja berawal `2023-01` dan berakhir `2023-01` dihitung `1` bulan. Bila kandidat magang 2 minggu (misal masuk 15 Jan keluar 30 Jan), dicatat sebagai 1 bulan penuh.
  2. **Boundary `parse_date_to_months`**:
     Format yang diterima hanya `YYYY` atau `YYYY-MM`. Jika kandidat mencantumkan format standar ISO `2023-05-15` atau format teks resume `May 2023`, regex `DATE_PATTERN` (`^(\d{4})(?:[-/](\d{1,2}))?(?:[-/]\d{1,2})?$`) akan gagal jika nama bulan berupa teks (English/Indonesian), mengembalikan `None`, dan masa kerja kandidat hangus diabaikan (0 tahun).
  3. **Piecewise Linear S_exp Discontinuity**:
     Formula pengalaman:
     - MergedYears < 1.0 tahun: 20.0
     - 1.0 s/d 3.0 tahun: $20.0 + \frac{Years - 1.0}{2.0} \times 40.0$
     - > 3.0 tahun: $\min(100.0, 60.0 + \frac{Years - 3.0}{2.0} \times 40.0)$
     Terdapat step lonjakan di batas 1.0 tahun: kandidat 0.99 tahun (11 bulan) bernilai 20.0, begitu mencapai 1.0 tahun bernilai 20.0. Pada batas 3.0 tahun: $20 + (2/2 \times 40) = 60.0$, kontinuitas terjaga di 60.0. Namun di bawah 1.0 tahun skor flat 20.0 tanpa gradasi (kandidat 0 bulan sama persis dengan kandidat 11 bulan).

#### D. Bias Penilaian Portfolio (`calculate_portfolio_score`)
- **Lokasi**: `backend/app/core/scoring.py:485-513`
- **Masalah & Celah**:
  1. **Hukuman Mutlak 0.0 bagi Programmer Tanpa Akun GitHub Publik**:
     Jika `is_programmer_role=True` dan kandidat tidak menyertakan repo GitHub publik atau bekerja di bawah NDA/enterprise repositori privat, $S_{port} = 0.0$. Dengan bobot 20% (0.2), skor maksimal kandidat langsung terpangkas ke 80.0, sehingga **tidak akan pernah bisa menembus ambang `STRONG_MATCH` (cutoff 85.0)** meskipun kemampuan koding & pengalamannya sempurna (100).
  2. **Sebaliknya, untuk Non-Programmer**:
     Diberi skor gratis minimal 70.0 (jika tanpa link) atau 100.0 (jika ada string URL apa pun), tanpa verifikasi keabsahan konten portofolio non-programmer. Hal ini menciptakan bias struktural antar disiplin peran.

#### E. Flaw pada Reduksi Bukti Kompetensi (`_collapse_exact_duplicates`)
- **Lokasi**: `backend/app/core/scoring.py:395-426`
- **Masalah & Celah**:
  1. Di `calculate_skill_score`, skor agregat dihitung dari rata-rata `match_scores` per core competency ($M$ buah).
  2. Namun saat collapsing di `_collapse_exact_duplicates`, jika 1 klaim skill yang sama (misal `PostgreSQL`) memenuhi 2 requirement berbeda (`PostgreSQL` dan `Relational Database`), key deduplikasi menggunakan `normalize_technology_key(claim_tech)`.
  3. Catatan bukti yang lolos hanya satu entri (yang memiliki score_contribution tertinggi), sementara `matched_requirement` digabung dengan koma. Jika panjang gabungan requirement melebihi 100 karakter, dilakukan truncating `joined[:100]`, berisiko memotong nama requirement di tengah kata secara kasar.

#### F. Inklusivitas & Fluff Guard Regex Boundary (`is_tier3_metric_claim`)
- **Lokasi**: `backend/app/core/scoring.py:23-43, 130-155`
- **Masalah & Celah**:
  1. Regex `METRIC_PATTERN` mendeteksi unit seperti `%`, `x`, `ms`, `k`, `m`, `jt`.
  2. Pengecekan kata konteks kedua (fallback baris 150):
     `for word in (CONTEXT_KEYWORDS - {"karyawan", "dokumen"})`
     Bila klaim mencantumkan kata metrik yang menempel pada tanda kurung atau tanda baca tertentu, substitusi `METRIC_PATTERN.sub(" ", combined)` terkadang menyisakan fragmen yang tidak cocok dengan batas `(?<![a-z0-9])word(?![a-z0-9])`.
  3. `inclusivity_from_findings` (baris 46-75): Penalti arbitrer (High: 15, Med: 8, Low: 4). Skor dipatok `max(0, 100 - penalty)`. Tidak ada batas atas akumulasi temuan; jika ada 7 temuan High, skor langsung 0 (`NEEDS_REVISION`).

---

### 3. Kelemahan pada Test Suite (`test_scoring_engine.py`)

1. **Zero / Empty Data Edge Cases Belum Diuji**:
   - Belum ada pengujian jika `claims = []`, `core_competencies = []`, atau `career_timeline = []`.
   - Belum ada test untuk custom `weights` yang invalid (misal bobot 0 semua, bobot parsial, atau bobot tidak normal).
2. **Missing Boundary Tests pada Tanggal Kerja**:
   - Tidak ada pengujian untuk format tanggal invalid/corrupted (misal `"2022-99"`, `"present-future"`, atau string kosong).
   - Tidak ada pengujian overlap yang tepat 3 bulan vs 4 bulan untuk memastikan ambang batas PRD (> 3 bulan).
3. **Portfolio Bias Tests Tidak Menguji Batas Cutoff**:
   - Kasus kandidat programmer dengan skill dan pengalaman bernilai 100 namun tanpa GitHub publik belum diuji apakah sengaja di-drop dari `STRONG_MATCH`.
4. **Kekurangan Kasus Non-Programmer**:
   - `test_scoring_engine.py` hanya menguji profil teknis/programmer (`budi`, `reza`, `citra`, `dewi`, `eko`). Tidak ada unit test untuk `is_programmer_role=False` di file ini (meskipun ada sebagian di `test_universal_domain.py`).

---

### 4. Rekomendasi Perbaikan Matematis & Kode

1. **Sanitasi dan Normalisasi Bobot**:
   - Validasi kelengkapan keys pada `weights` sebelum normalisasi; isi key yang hilang dengan nilai 0.0 (bukan fallback default) bila custom weights diberikan.
   - Tambahkan proteksi bila `total_w <= 0` atau mengandung nilai negatif/NaN.
2. **Harmonisasi Taksonomi Dua Arah (Bidirectional)**:
   - Buat helper graph pencarian taksonomi simetris sehingga relasi ekosistem terdeteksi dua arah tanpa celah.
3. **Penyempurnaan Penanganan Tanggal & Parse Fallback**:
   - Dukung ekstraksi format tanggal dengan nama bulan atau regex yang lebih lentur sebelum mengembalikan `None`.
4. **Penyesuaian Bobot Portfolio untuk Kandidat Enterprise/Non-Open-Source**:
   - Berikan opsi fallback skor portofolio berbasis proyek terverifikasi non-GitHub jika NDA berlaku, agar kandidat tidak terhukum 0 secara permanen.
5. **Perluasan Test Suite**:
   - Tambahkan test coverage untuk boundary cases: timeline kosong, tanggal invalid, bobot parsial, overlap tepat 3 bulan, dan zero-competency.
