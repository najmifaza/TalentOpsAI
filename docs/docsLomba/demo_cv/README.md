# Paket CV Demo — TalentOps AI

Berkas di folder ini dipakai untuk menguji seluruh detektor sistem. Semuanya hasil generate
ulang lewat `build_demo_cv.py` — jangan diedit manual, ubah spesifikasinya di skrip.

## Cara membuat ulang

```bash
python build_demo_cv.py             # paket ringkas (6 berkas, default)
python build_demo_cv.py --set penuh # semua kasus (13 berkas)
python build_demo_cv.py --no-pdf    # DOCX saja
python build_demo_cv.py --verify    # cetak hasil audit detektor untuk tiap berkas
```

## Daftar berkas dan hasil yang diharapkan

| Berkas | Lowongan | Kasus | Hasil yang diharapkan |
|---|---|---|---|
| `cv_01_backend_strong.pdf` | 1 · Senior Backend Engineer | bersih | STRONG_MATCH (skor ≥ 85, keyakinan HIGH, risiko LOW) + slot wawancara terkunci otomatis |
| `cv_02_backend_overlap.pdf` | 1 · Senior Backend Engineer | kerja bertumpuk | CONCURRENT_FULLTIME_OVERLAP_24_MONTHS (HIGH) — dua peran penuh waktu berjalan bersamaan 24 bulan |
| `cv_04_backend_experience_inflation.pdf` | 1 · Senior Backend Engineer | klaim pengalaman mengarang | EXPERIENCE_CLAIM_INFLATION (MEDIUM) — klaim 8 tahun vs timeline terbaca ±1,4 tahun |
| `cv_07_backend_prompt_injection.pdf` | 1 · Senior Backend Engineer | prompt injection (teks putih + tak terlihat) | PDF_WHITE_TEXT + PDF_INVISIBLE_RENDER_MODE (HIGH) → SECURITY_QUARANTINE_PROMPT_INJECTION, mustahil STRONG_MATCH |
| `cv_11_tax_accounting.pdf` | 3 · Senior Tax & Accounting Specialist | non-IT (sengaja) | Audit GitHub dilewati adaptif (skipped_non_tech), tanpa penalti skor portofolio |
| `cv_09_backend_duplicate.pdf` | 1 · Senior Backend Engineer | CV duplikat | DUPLICATE_RESUME_UPLOAD (MEDIUM) — hash SHA-256 sama dengan cv_01, berikut nomor dossier asalnya |

## Urutan demo yang disarankan

1. **cv_01** unggah ke lowongan #1 → tunjukkan `STRONG_MATCH` dan slot wawancara terkunci
   otomatis, lalu buka tab **Simulasi Wawancara AI**.
2. **cv_02** unggah ke lowongan #1 → anomali kerja bertumpuk 24 bulan muncul di dossier
   bersama kedua peran dan periodenya.
3. **cv_03** → inflasi jabatan; **cv_04** → inflasi klaim pengalaman; **cv_05** → jeda karier.
4. **cv_07** → berkas dikarantina: teks putih dan teks tak terlihat tertangkap, prioritas
   `HIGH_ATTENTION`, mustahil `STRONG_MATCH`.
5. **cv_08** → CV scan: sistem jujur menyatakan berkas butuh OCR, bukan mengarang nilai.
6. **cv_01 lalu cv_09** → berkas identik ditandai duplikat berikut nomor dossier asalnya.
7. **cv_11 / cv_12 / cv_13** → jalur non-IT: audit GitHub dilewati adaptif, bukti dokumen
   tetap ditelusuri.

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
| cv_01, cv_06, cv_07, cv_08, cv_10–cv_13 | tidak ada flag struktural | LOW |

## Catatan untuk penguji

* Verifikasi portofolio memanggil GitHub API sungguhan. `cv_06` sengaja menunjuk repositori
  yang tidak ada agar skor portofolio turun; pada kandidat lain dipakai repositori publik
  yang benar-benar ada.
* Bila konsensus dua model menandai `LOW_CONFIDENCE_EXTRACTION` pada cv_01, ulangi triase
  sekali lagi atau jalankan demo dengan `DUAL_MODEL_VERIFY=false` untuk berkas itu.
