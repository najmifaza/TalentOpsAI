# Paket CV Demo — TalentOps AI

Berkas di folder ini dipakai untuk menguji seluruh detektor sistem. Semuanya hasil generate
ulang lewat `build_demo_cv.py` — jangan diedit manual, ubah spesifikasinya di skrip.

## Cara membuat ulang

```bash
python build_demo_cv.py             # paket ringkas (2 berkas inti video, default)
python build_demo_cv.py --set penuh # semua kasus (14 berkas)
python build_demo_cv.py --no-pdf    # DOCX saja
python build_demo_cv.py --verify    # cetak hasil audit detektor untuk tiap berkas
```

## Daftar berkas dan hasil yang diharapkan

| Berkas | Lowongan | Kasus | Hasil yang diharapkan |
|---|---|---|---|
| `cv_01_backend_strong.pdf` | 1 · Senior Backend Engineer | bersih | STRONG_MATCH (skor ≥ 85, keyakinan HIGH, risiko LOW) + slot wawancara terkunci otomatis |
| `cv_14_backend_multi_anomali.pdf` | 1 · Senior Backend Engineer | berkas curang berlapis (anomali klaim + prompt injection) | 5 anomali dari satu unggahan: SECURITY_QUARANTINE_PROMPT_INJECTION (HIGH), CONCURRENT_FULLTIME_OVERLAP_24_MONTHS, TITLE_INFLATION_DETECTED, CAREER_BREAK_FLAG, EXPERIENCE_CLAIM_INFLATION (klaim 8 tahun vs timeline ±2,9 tahun) → REVIEW_REQUIRED, prioritas HIGH_ATTENTION; unggah ulang → DUPLICATE_RESUME_UPLOAD |
| `cv_09_backend_duplicate.pdf` | 1 · Senior Backend Engineer | CV duplikat | DUPLICATE_RESUME_UPLOAD (MEDIUM) — hash SHA-256 sama dengan cv_01, berikut nomor dossier asalnya |

## Urutan demo yang disarankan

1. **cv_01** unggah ke lowongan #1 → tunjukkan `STRONG_MATCH` dan slot wawancara terkunci
   otomatis, lalu buka tab **Simulasi Wawancara AI**.
2. **cv_14** unggah ke lowongan #1 → satu berkas memicu enam temuan sekaligus: karantina
   keamanan, kerja bertumpuk 24 bulan, inflasi klaim pengalaman, inflasi jabatan, dan jeda
   karier. Verdict `REVIEW_REQUIRED`, prioritas `HIGH_ATTENTION`.
3. **cv_14 diunggah ulang** → berkas identik ditandai `DUPLICATE_RESUME_UPLOAD` berikut nomor
   dossier asalnya. Tidak perlu berkas tambahan.
4. Berkas paket `penuh` (`cv_02`–`cv_13`) tetap tersedia bila perlu menguji detektor satu per
   satu: `cv_03` inflasi jabatan, `cv_05` jeda karier, `cv_06` repo GitHub tidak ada, `cv_08`
   CV scan, `cv_11`–`cv_13` jalur non-IT.

## Verifikasi

Dua cara, keduanya tanpa perlu upload lewat UI:

```bash
# 1. Audit berkas: detektor PDF + detektor klaim pengalaman (tanpa LLM, tanpa DB)
python build_demo_cv.py --verify

# 2. Uji logika flag dari spesifikasi CV (kerja bertumpuk, inflasi jabatan, jeda karier)
python verify_demo_cv.py --offline
```

`verify_demo_cv.py` versi penuh menjalankan ekstraksi LLM + skor dengan bobot dan kompetensi
lowongan asli dari database:

```bash
export TALENTOPS_DB_URL='mysql://user:pass@host:3306/talentops_db'
python verify_demo_cv.py            # semua berkas
python verify_demo_cv.py cv_04      # satu berkas
```

Butuh gateway LLM hidup **dan API key yang valid** di `backend/.env`
(`LLM_API_KEY` / `LLM_ROUTER_API_KEY`). Tanpa key, gateway menolak dengan
`401 Missing API key` — pakai `--offline` sebagai gantinya.

Hasil `--offline` yang sudah terbukti (9 November 2026):

| Berkas | Flag yang muncul | Risiko |
|---|---|---|
| cv_02 | `CONCURRENT_FULLTIME_OVERLAP_24_MONTHS` | HIGH |
| cv_03 | `TITLE_INFLATION_DETECTED` | MEDIUM |
| cv_04 | klaim 8 tahun vs timeline 1,42 tahun → inflasi terdeteksi | MEDIUM (dari pipeline) |
| cv_05 | `CAREER_BREAK_FLAG` | LOW |
| cv_14 | `SECURITY_QUARANTINE_PROMPT_INJECTION`, `CONCURRENT_FULLTIME_OVERLAP_9_MONTHS`, `CONCURRENT_FULLTIME_OVERLAP_24_MONTHS`, `TITLE_INFLATION_DETECTED`, `CAREER_BREAK_FLAG` + inflasi klaim 8 tahun vs 2,92 tahun | HIGH → `REVIEW_REQUIRED` |
| cv_01, cv_06, cv_07, cv_08, cv_10–cv_13 | tidak ada flag struktural | LOW |

## Catatan untuk penguji

* Verifikasi portofolio memanggil GitHub API sungguhan. `cv_06` sengaja menunjuk repositori
  yang tidak ada agar skor portofolio turun; pada kandidat lain dipakai repositori publik
  yang benar-benar ada.
* Bila konsensus dua model menandai `LOW_CONFIDENCE_EXTRACTION` pada cv_01, ulangi triase
  sekali lagi atau jalankan demo dengan `DUAL_MODEL_VERIFY=false` untuk berkas itu.
