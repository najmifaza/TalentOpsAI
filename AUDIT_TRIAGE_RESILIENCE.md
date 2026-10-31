# AUDIT REPORT: TRIAGE PIPELINE, SANITIZATION, SSE STREAMING GUARD, & SELF-HEALING FALLBACK

Tanggal Audit: 31 Oktober 2026  
Target Audit:
- `backend/app/core/triage_service.py`
- `backend/app/core/sanitizer.py`
- `backend/app/core/broadcaster.py`
- `backend/tests/test_triage_pipeline.py` & `backend/tests/test_sse_stream_guard.py`

---

## 1. Executive Summary

Audit arsitektur dan kode backend mengungkap bahwa pipeline triage telah mengadopsi mekanisme mitigasi multi-lapisan (self-healing heuristic fallback, anti-hallucination substring guard, PII normalisation NFKC, dan single-use ticket-guarded SSE). Namun demikian, ditemukan sejumlah celah resilience, edge case sanitasi, potensi memory leak / stream hanging pada SSE generator, dan coverage gap dalam unit test.

---

## 2. Temuan Audit Komprehensif

### A. Pipeline Triage & Self-Healing Fallback (`backend/app/core/triage_service.py`)

1. **Heuristic Fallback Extraction (`_extract_heuristic_fallback`)**
   - **Kelebihan**: Berhasil mengatasi kegagalan gateway LLM tanpa memutus alur triage, melakukan scanning deterministik terhadap taksonomi kompetensi dan kronologi kerja.
   - **Kelemahan (Heuristic Fragility)**:
     - Regex ekstraksi tanggal (`date_range_pattern`) mengasumsikan tahun format `20\d{2}`. Kandidat senior dengan pengalaman tahun 1990-an (`1995-2005`) tidak akan terdeteksi riwayat kerjanya pada mode fallback, menghasilkan timeline kosong atau terdegradasi ke default fallback.
     - Penentuan nama perusahaan (`company_candidate`) menggunakan pemotongan string sederhana (`" | "`, `" at "`, `" - "`). Jika teks CV hasil parsing PDF memiliki format `Perusahaan - Posisi` terbalik atau format tanpa pemisah standar, parsing menghasilkan atribut terbalik atau fallback ke `"Perusahaan Terdaftar"`.
     - Normalisasi derajat pendidikan (`degree`) memiliki fallback default ke `"S1"`, yang berpotensi melebih-lebihkan (over-estimate) pelamar lulusan SMA/SMK/D3 jika teks tidak tertangkap regex.

2. **Transaction & State Consistency pada Eksepsi Triage**
   - **Kelemahan**: Jika terjadi exception di tengah eksekusi `execute_triage` setelah status kandidat diubah menjadi `'analyzing'` (misalnya kegagalan database query pada step persistensi bukti `candidate_evidence`), kandidat dapat tersangkut permanen di status `'analyzing'`. Handler luar (`_run_triage_background` di `candidates.py`) mempublikasikan SSE gagal, tetapi tidak mengembalikan status kolom `status` di tabel `candidates` ke `'failed'` atau `'review_required'`.

3. **Anomalies Persistence Overwrite**
   - Re-triage mengeksekusi `DELETE FROM candidate_anomalies WHERE candidate_id = :id`. Meskipun kode berupaya mempertahankan security anomalies (`existing_security_anoms`), anomali non-security historis dari audit manual recruiter/auditor yang tersimpan di tabel ini akan terhapus bersih tanpa audit trail.

---

### B. Input Sanitization & UU PDP Compliance (`backend/app/core/sanitizer.py`)

1. **Efektivitas Sanitasi PII**
   - **Kelebihan**: Normalisasi Unicode NFKC dan pembersihan zero-width character (`\u200b`, `\ufeff`, dll.) sangat efektif menangkal teknik obfuscation bypass.
   - **Kelemahan & Edge Cases**:
     - **Nomor Telepon Lokal & Separator Tak Baku**: `_RE_PHONE` memerlukan awalan `+62`, `08`, atau `02`. Nomor telepon kantor/rumah dengan kode area non-Jakarta (misal: Bandung `022`, Surabaya `031`, Semarang `024`) tidak tertangkap oleh `02[1-9]` (karena `022` digit ketiganya 2 dan panjangnya bervariasi). Ini berpotensi membocorkan nomor telepon rumah/kantor pelamar.
     - **Name Redaction Collision**: Redaksi nama varian memotong nama per kata dengan panjang $\ge 4$ karakter (`_redact_name_variants`). Jika pelamar bernama depan atau tengah kata umum bahasa Indonesia/Inggris (seperti "Putra", "Kurnia", "Prima", "Hope", "Best"), kata-kata umum tersebut dalam narasi resume akan ter-redact secara agresif menjadi `[NAME_REDACTED]`, menurunkan kualitas pemahaman konteks teknis LLM/heuristic.
     - **Residual Risk Tracking**: Pada mode `header_inference`, deteksi huruf kapital (`_RE_CAPITALISED_RUN`) memasukkan nama institusi, tools, atau sertifikasi (misal: "Certified Ethical Hacker", "PostgreSQL Database") ke dalam `residual_name_candidates` jika tidak terdaftar di stopwords, menyebabkan false positive alarm pada audit log.

---

### C. SSE Streaming Guard & Pub/Sub Broadcaster (`backend/app/core/broadcaster.py`)

1. **Ticket Guard & Burn-on-Read**
   - **Kelebihan**: Penggunaan token UUIDv4 sekali pakai dengan TTL 60 detik dan verifikasi burn-on-read mencegah penyerang menguping stream tanpa otorisasi.
   - **Kelemahan (Hanging Stream & Resource Leak)**:
     - Pada `subscribe` (baik in-memory maupun Redis), jika client SSE putus koneksi secara mendadak tanpa membaca event terminal (`completed` atau `failed`), generator pada `_subscribe_redis` melakukan blocking loop `pubsub.get_message()`. Generator baru berhenti ketika client socket ditutup oleh server runtime, tetapi jika streaming response di-buffer oleh proxy yang salah konfigurasi, task subscriber dapat tertahan.
     - Pada in-memory queue (`asyncio.Queue(maxsize=100)`), jika listener lambat mengonsumsi dan antrean penuh, pesan di-drop dengan log warning (`Queue full for listener`), yang dapat menyebabkan client kehilangan event status kritis.

2. **Terminal Event Race Condition**
   - Event terminal ditentukan oleh flag `is_terminal`. Jika sebuah step gagal tetapi memicu status kustom di luar `TERMINAL_EVENTS`, subscriber in-memory akan tetap menunggu event berikutnya hingga timeout client terjadi.

---

### D. Audit Test Suite (`backend/tests/test_triage_pipeline.py`)

1. **Kekurangan Uji Penetrasi & Resilience**:
   - `test_triage_pipeline.py` saat ini hanya menguji "happy path" di mana LLM mock mengembalikan payload JSON valid, GitHub adapter berhasil, dan slot kalender tersedia.
   - **Test Gap**:
     - Tidak ada unit test untuk `_extract_heuristic_fallback` ketika LLM gateway mock melempar exception (`TimeoutError`, `APIConnectionError`).
     - Tidak ada simulasi partial failure (misal: GitHub API rate-limit 403 atau down).
     - Tidak ada pengujian race condition tiket SSE saat multi-client mencoba me-redeem tiket yang sama secara bersamaan.
     - Tidak ada verifikasi pemulihan status DB saat terjadi error di step 6 atau 7.

---

## 3. Matriks Rekomendasi Tindakan (Action Items)

| Area | Isu | Rekomendasi Solusi | Prioritas |
| :--- | :--- | :--- | :--- |
| **Triage Service** | Exception menyebabkan status menggantung di `'analyzing'` | Bungkus `execute_triage` dengan blok `try-finally` atau update status ke `'failed'` di database jika terjadi exception fatal. | **HIGH** |
| **Heuristic Fallback** | Date regex kaku pada `20\d{2}` | Perluas regex tanggal ke `(19\d{2}\|20\d{2})` agar tidak membuang riwayat kerja kandidat senior. | **MEDIUM** |
| **Sanitizer** | Prefix telepon regional non-Jakarta terlewat | Perbarui pattern kode area telepon fixed-line Indonesia (`0[2-9]\d{1,2}`). | **MEDIUM** |
| **Sanitizer** | Over-redaction nama pada kata umum kamus | Tambahkan filter safelist/dictionary exclusion pada pemotongan nama per token $\ge 4$ karakter. | **LOW** |
| **SSE Broadcaster** | In-memory queue drop saat penuh | Tambahkan sliding window / buffer eviction teratur pada queue listener yang lambat. | **LOW** |
| **Test Suite** | Tidak ada uji fallback & failure injection | Tambahkan test case eksplisit untuk `LLMAdapter.complete` failure mode dan verifikasi output fallback. | **HIGH** |

---

*Laporan audit selesai dan terdokumentasi.*
