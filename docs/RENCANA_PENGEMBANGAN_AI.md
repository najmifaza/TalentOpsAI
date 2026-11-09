# Rencana Pengembangan Modul AI — TalentOpsAI

**Tanggal:** 9 November 2026
**Konteks:** GTNIC 2026 — AI Agent Development (batas submit 10 November 2026, 23:59 WIB)
**Branch acuan:** `main`
**Status pengujian awal:** `pytest backend/tests -q` → 224 passed, 0 failed

Dokumen ini merinci empat pengembangan pada jalur AI yang layak dikerjakan **sebelum submit**,
dipilih karena (a) menyentuh indikator penilaian berbobot besar, (b) tidak butuh dependensi
baru atau migrasi basis data, dan (c) terlihat di video demo.

Urutan prioritas: **#8 → #4 → #3 → #5**.

> **Status implementasi — 9 November 2026:** keempat item **selesai dan teruji**.
> `pytest backend/tests -q` → **332 passed, 0 failed** (baseline 290 sebelum perubahan),
> `npm run build` di `frontend/` sukses tanpa error. Rincian di §12.

---

## 1. Ringkasan

| # | Item | Inti perubahan | Bobot juri yang disasar | Effort |
|---|---|---|---|---|
| 3 | Pertanyaan interview digenerate LLM | Template f-string → 3–4 pertanyaan kontekstual per kandidat dari bukti nyata | Inovasi (10%), UX (5%) | Rendah |
| 4 | Dual-model cross-check | Ekstraksi tunggal → dua model paralel + skor kesepakatan + penurunan confidence otomatis | Penalaran (15%), otonomi (25%) | Rendah |
| 5 | Audit bias JD hybrid | 4 regex statis → regex (deterministik) + LLM (nuansa bahasa), digabung & dedupe | Inovasi (10%), nilai bisnis (10%) | Sedang |
| 8 | Moderation output | Tidak ada → penyaring keluaran di tiga titik teks bebas | Kepatuhan guidebook, dokumentasi (5%) | Rendah |

**Yang tidak dikerjakan dalam dokumen ini:** agentic tool loop (ReAct) dan hybrid retrieval/RAG.
Keduanya berisiko tinggi dan dijelaskan di §7 sebagai *Future Development* proposal.

---

## 2. Dasar Kewajiban dari Guidebook

| Sumber | Kalimat | Implikasi teknis |
|---|---|---|
| Ketentuan Karya butir 1 | "Sistem AI yang dibangun tidak boleh menghasilkan keluaran (bias/halusinasi) yang memuat unsur SARA, pornografi, kekerasan, provokatif" | Butuh guardrail di sisi **keluaran**, bukan hanya input → item #8 |
| Ketentuan Karya butir 3 | "AI Agent wajib memiliki fungsionalitas tingkat lanjut, seperti kemampuan reasoning, integrasi eksternal, atau RAG" | Reasoning harus terlihat, bukan hanya pipeline linear → item #4 |
| Indikator: Penalaran, Perencanaan, Pengambilan Keputusan | "…menangani ambiguitas, dan melakukan pemulihan otomatis apabila terjadi kegagalan instruksi" | Butuh mekanisme sadar-ambiguitas → item #4 |
| Indikator: Inovasi dan Kreativitas | "kebaruan pendekatan alur kerja, dan optimalisasi kapabilitas sistem cerdas" | Fitur yang tidak bisa ditiru pencocokan kata kunci → item #3, #5 |

---

## 3. Kondisi Implementasi AI Saat Ini (terverifikasi)

Temuan dari pembacaan langsung kode, bukan asumsi.

| Aspek | Fakta | Lokasi |
|---|---|---|
| Titik panggil LLM | **1 saja** di seluruh backend | `backend/app/core/triage_service.py:470` |
| Bentuk pipeline | 7 langkah lurus berurutan, tanpa cabang keputusan | `triage_service.py:285-295` |
| Tool eksternal | Nyata, tetapi dipanggil hardcoded (bukan dipilih model) | `adapters/github.py`, `adapters/calendar.py`, `core/email.py` |
| Adaptive loop | Hanya retry bentrok slot, ambang tetap 5 | `triage_service.py:50-73` |
| Embedding / vektor | **0 hasil** untuk `embedding`, `vector`, `faiss`, `pgvector`, `cosine` | seluruh repo |
| Relevansi skill | Exact match + dict statis 11 entri | `core/scoring.py:9-21`, `scoring.py:97-136` |
| Pertanyaan interview | Template f-string tunggal | `core/scoring.py:874-908` |
| Audit bias JD | 4 regex statis | `api/jobs.py:593-687` |
| Guardrail input | Sanitasi PII, deteksi teks tersembunyi, flag prompt injection | `core/sanitizer.py`, `core/hidden_text_detector.py`, `core/prompt.py:11` |
| Guardrail output | **Tidak ada** | — |
| Streaming | SSE per-langkah, bukan token LLM | `core/broadcaster.py` |

**Kesimpulan penilaian:** "Penggunaan Alat" (15%) relatif aman karena integrasi eksternalnya nyata.
Yang rawan adalah "Kapabilitas dan Otonomi Agen" (25%) dan "Penalaran/Perencanaan" (15%) — juri
dapat membaca arsitektur sekarang sebagai otomasi alur kerja berurutan, bukan agen yang menimbang.

---

## 4. Item #8 — Moderation Output (kerjakan pertama)

### 4.1 Tujuan
Menegakkan kewajiban Ketentuan Karya butir 1 pada teks yang **keluar** dari sistem, bukan hanya
pada teks yang masuk.

### 4.2 Kondisi sekarang
Tidak ada pemeriksaan sama sekali. Seluruh pengamanan bersifat inbound: `core/sanitizer.py`
(PII), `core/hidden_text_detector.py` (teks tersembunyi), `core/prompt.py:11` (flag injection).
Begitu model menghasilkan teks baru, teks itu langsung dikirim ke pengguna atau disimpan.

### 4.3 Perubahan
Berkas baru: **`backend/app/core/moderation.py`**.

```
check(text: str, *, context: str) -> ModerationResult
ModerationResult = {allowed: bool, reason: str | None, flagged_terms: list[str]}
```

Isi modul:
1. **Lapis pola (wajib, selalu jalan):** daftar tolak sempit — ujaran SARA terhadap suku/agama/ras,
   konten eksplisit, ancaman kekerasan. Cocokkan dengan batas kata, bukan substring.
2. **Lapis klasifikasi (opsional):** untuk teks > 300 karakter, minta model menilai
   `{safe: bool, category: str|null}` lewat `LLMAdapter`. Kalau gateway mati, lapis ini dilewati —
   hasilnya tetap `allowed` berdasarkan lapis pola saja, dan dicatat sebagai mode `PATTERNS_ONLY`.

Titik panggil:

| Titik | Teks | Perlakuan bila ditolak |
|---|---|---|
| Hasil item #3 | `scenario_question`, `evaluation_criteria` | Ganti dengan template deterministik yang sudah ada sekarang |
| Hasil item #5 | `actionable_suggestion` | Jatuhkan saran itu, pertahankan temuan regex |
| SSE `ai_thought` | narasi agen | Ganti narasi netral bawaan |

### 4.4 Yang TIDAK boleh disaring
`context_narrative` dan `metric_string` hasil ekstraksi adalah **kutipan verbatim CV**. Menyaringnya
akan memutus `CandidateExtractionSchema.apply_substring_guard` (`schemas/extraction.py:225`) dan
membuat bukti palsu. Kutipan verbatim dikecualikan secara eksplisit.

### 4.5 Batasan basis data
`agent_steps.status` adalah ENUM `('started','completed','failed','recovered')`
(`migrations/001_initial_schema.sql:157`). **Jangan** menambah nilai status baru tanpa migrasi.
Catat kejadian moderasi sebagai `status='completed'` dengan `payload_output` berisi
`{"moderation_blocked": true, "reason": "..."}`.

### 4.6 Risiko dan mitigasi
| Risiko | Mitigasi |
|---|---|
| False positive memotong keluaran sah | Pola wajib sempit; bila ragu, tandai (`flagged`) bukan blokir |
| Kutipan CV ikut diblokir | Whitelist eksplisit untuk field bukti verbatim (§4.4) |
| Mode `PATTERNS_ONLY` sulit dideteksi | Tampilkan di payload langkah agar terlihat di Agent Trace |

### 4.7 Test
`backend/tests/test_output_moderation.py` (baru): satu kasus diblokir, satu kasus lolos, satu kasus
kutipan verbatim tidak tersentuh, satu kasus gateway mati → `PATTERNS_ONLY`.

### 4.8 Bukti untuk juri
Satu sub-bab proposal "Batasan sistem dan mitigasi risiko" yang benar-benar punya kode, bukan janji.
Dapat didemokan: suntik teks provokatif ke CV → sistem menolak menampilkannya dan mencatat di trace.

---

## 5. Item #4 — Dual-Model Cross-Check

### 5.1 Tujuan
Membuat sistem **sadar** ketika ekstraksi LLM tidak dapat dipercaya, lalu menurunkannya sendiri ke
antrean review manusia — tanpa campur tangan operator.

### 5.2 Kondisi sekarang
`LLMAdapter.complete()` (`llm_adapter.py:60-157`) memanggil satu model. `LLM_FALLBACK_MODEL`
(`config.py:38`) hanya dipakai **setelah** model utama gagal total (baris 94-96), bukan untuk
verifikasi silang. Tidak ada sinyal apa pun tentang tingkat kepercayaan ekstraksi.

### 5.3 Perubahan
Jalankan dua ekstraksi paralel dengan `asyncio.gather`, lalu bandingkan.

| Metrik banding | Cara hitung | Ambang divergen |
|---|---|---|
| Kesepakatan skill | Jaccard dua himpunan `technology` setelah `normalize_technology_key()` (`scoring.py:229`) | < 0.70 |
| Panjang riwayat kerja | selisih jumlah entri `career_timeline` | > 1 entri |
| Anomali | flag yang hanya muncul di satu model | ada selisih |
| URL | `github_url`/`portfolio_url` berbeda | ada selisih |

`extraction_agreement` = rata-rata berbobot dari metrik di atas (skala 0.0–1.0).

Efek saat divergen:
1. Sisipkan anomali `LOW_CONFIDENCE_EXTRACTION` ke `candidate_anomalies`
   (`anomaly_type` bebas string, `severity` ENUM `LOW|MEDIUM|HIGH`).
2. Turunkan `confidence_level` (`candidates.confidence_level` ENUM `HIGH|MEDIUM|LOW`) satu tingkat.
3. Set `triage_priority='HIGH_ATTENTION'`.
4. Simpan `extraction_agreement` di `payload_output` langkah `llm_extraction` — **tidak perlu
   kolom baru**, nilainya sudah dapat dibaca lewat endpoint trace yang ada.

### 5.4 Kontrol biaya
Setting baru: `DUAL_MODEL_VERIFY: bool = True` di `core/config.py`, plus `LLM_CROSSCHECK_MODEL`
default `ag/gemini-3.8-flash-high`. Bila `False`, perilaku kembali persis seperti sekarang —
zero risiko regresi saat demo.

### 5.5 Risiko dan mitigasi
| Risiko | Mitigasi |
|---|---|
| Latensi ±2× | `asyncio.gather` paralel; timeout per panggilan tetap dibatasi 12 s (`llm_adapter.py:99`) |
| Biaya token 2× | Batasi hanya untuk kandidat yang lolos gerbang pra-saring, atau matikan lewat setting |
| Dua model sama-sama salah | Bukan masalah: kesepakatan mengukur stabilitas, bukan kebenaran absolut. Ditulis apa adanya di proposal |
| Cache deterministik melewati verifikasi | `PRE_CACHED_STORE` tetap dipakai lebih dulu; cross-check hanya jalan pada jalur `LIVE` |

### 5.6 Test
`backend/tests/test_dual_model_crosscheck.py` (baru): (a) dua model identik → `agreement = 1.0`,
confidence tidak turun; (b) divergen → flag muncul, confidence turun satu tingkat, priority jadi
`HIGH_ATTENTION`; (c) `DUAL_MODEL_VERIFY=False` → satu panggilan saja (verifikasi jumlah request
lewat mock).

### 5.7 Bukti untuk juri
Menjawab langsung dua indikator sekaligus: "menangani ambiguitas" dan "pemulihan otomatis".
Skenario demo: satu CV sengaja ambigu → dua model menyimpang → sistem menurunkan confidence sendiri
dan mengeskalasi ke HITL tanpa operator menyentuh apa pun.

---

## 6. Item #3 — Pertanyaan Interview Digenerate LLM

### 6.1 Tujuan
Mengganti pertanyaan generik dengan pertanyaan yang menunjuk bukti spesifik kandidat.

### 6.2 Kondisi sekarang
`scoring.py:874-908`. Satu pertanyaan, satu frasa template, dipilih lewat ambang tetap
(`skill_score < 70.0`). Contoh keluaran saat ini:
`"Explain concurrency control ... when implementing {target_skill}."`
Dua kandidat berbeda dengan gap berbeda bisa menerima pertanyaan identik.

### 6.3 Perubahan
Panggilan LLM kedua di `triage_service._execute_triage_core` langkah 7, setelah scoring
(`triage_service.py:610-650`) dan sebelum persist (`triage_service.py:757-775`).

Berkas baru: **`backend/app/core/interview_generator.py`**.

Input ke prompt:
- `job_title`, `core_competencies`
- `claims` yang sudah lolos substring guard — hanya ini yang boleh dirujuk
- `assessment["evidence_records"]` (`target_competency`, `matched_requirement`, `verified`)
- `assessment["anomaly_details"]`
- `recommendation`, `dimension_scores`

Kontrak keluaran:
```json
{
  "questions": [
    {
      "target_skill": "Redis",
      "difficulty_level": "L2_SYSTEM_DESIGN",
      "scenario_question": "...",
      "evaluation_criteria": "...",
      "follow_ups": ["...", "..."]
    }
  ]
}
```

Aturan di system prompt:
1. Maksimum 4 pertanyaan; setiap pertanyaan **wajib** merujuk satu klaim atau evidence yang ada di
   input. Dilarang mengarang proyek, perusahaan, atau angka.
2. Klaim yang `verified = false` atau tanpa metrik → probing lebih dalam (`L2_SYSTEM_DESIGN`),
   bukan asumsi dasar.
3. Dilarang menanyakan universitas, jenis kelamin, usia, atau status perkawinan — konsisten dengan
   aturan anti-bias yang sudah ada di `core/prompt.py:12` (UU Ketenagakerjaan No. 13/2003).
4. Bahasa keluaran: Bahasa Indonesia. Keluarkan JSON saja, tanpa pagar markdown.

### 6.4 Batasan basis data — wajib dibaca
`candidate_assessments.difficulty_level` adalah ENUM `('L1_FUNDAMENTAL','L2_SYSTEM_DESIGN','L3_EDGE_CASE')`
(`migrations/001_initial_schema.sql:123`). MariaDB berjalan dengan `STRICT_TRANS_TABLES`, sehingga
satu nilai di luar enum **menggagalkan seluruh transaksi triage** — peringatan ini sudah tercatat di
`scoring.py:892-895`. Normalisasi setiap nilai dengan helper `_match_enum(value, valid, aliases, fallback)`
yang sudah ada di `schemas/extraction.py:53` sebelum INSERT.

Tabel tidak punya kolom `follow_ups`. Dua pilihan:
- **Default (tanpa migrasi):** gabungkan follow-up ke `scenario_question` sebagai daftar bernomor.
- **Opsional:** migrasi `011_assessment_followups.sql` menambah kolom `follow_up_questions TEXT NULL`.

Ambil opsi default selama waktu submit masih mepet.

### 6.5 Fallback
Bila LLM gagal atau keluaran tidak valid → **pertahankan blok template deterministik yang sudah ada
sekarang** sebagai cabang `else`. Jangan hapus kode lama. Sistem harus tetap menghasilkan pertanyaan
walau gateway mati, dan itu sendiri poin recovery.

### 6.6 Risiko dan mitigasi
| Risiko | Mitigasi |
|---|---|
| Nilai enum di luar daftar → triage gagal | `_match_enum` sebelum INSERT (§6.4) |
| Latensi tambahan | Jalankan paralel dengan persist `candidate_evidence`; batas 12 s per panggilan |
| Model mengarang proyek/angka | Validasi: `target_skill` harus ada di `core_competencies` atau `claims`; kalau tidak, buang pertanyaan itu |
| Keluaran bermuatan sensitif | Lewatkan ke item #8 sebelum disimpan |

### 6.7 Test
`backend/tests/test_interview_generator.py` (baru): (a) keluaran valid → jumlah baris
`candidate_assessments` sesuai; (b) `difficulty_level` ngawur → dinormalisasi, tidak ada exception;
(c) LLM error → template lama dipakai; (d) `target_skill` di luar `core_competencies` → pertanyaan
dibuang.

### 6.8 Bukti untuk juri
Bagian demo paling kuat: dua kandidat berbeda posisi menampilkan pertanyaan berbeda, dan setiap
pertanyaan dapat dilacak balik ke baris `candidate_evidence` yang menjadi dasarnya.

---

## 7. Item #5 — Audit Bias JD Hybrid

### 7.1 Tujuan
Menangkap bias tersirat yang tidak punya pola literal, tanpa mengorbankan determinisme dan tanpa
membuat endpoint publik bergantung pada ketersediaan LLM.

### 7.2 Kondisi sekarang
`api/jobs.py:593-687`. Empat aturan regex statis: `GENDER_EXCLUSIVE_TERMS`,
`AGE_DISCRIMINATION`, `INSTITUTION_PRESTIGE_BIAS`, `AMBIGUOUS_WORK_EXPECTATIONS`. Kuat pada pola
literal, buta pada kiasan: "energik dan single", "culture fit dengan tim muda", "fleksibel tanpa
batas" tidak tertangkap.

### 7.3 Perubahan — dua lapis, bukan penggantian
1. **Lapis deterministik (dipertahankan utuh).** Empat regex sekarang tetap jalan dan tetap diuji.
   Ini yang menjamin hasil identik pada setiap pemanggilan.
2. **Lapis LLM (baru).** Kirim `raw_text` JD, minta temuan terstruktur dengan skema identik:
   `{category, severity, matched_term, context_snippet, actionable_suggestion}`. Kategori dibatasi
   ke empat enum yang sudah ada supaya bisa digabung.
3. **Penggabungan.** Dedupe berdasarkan pasangan `(category, matched_term.lower())`. Bila
   bertabrakan, temuan regex yang menang, karena posisi `matched_term` di teks sudah pasti.
4. **Skor.** Tetap dihitung lewat `inclusivity_from_findings()` (`scoring.py:55-84`). **Jangan**
   membuat rumus kedua — komentar di fungsi itu menyatakan ia single source of truth antara endpoint
   audit dan portal publik. Skor berbeda di dua tempat adalah bug yang secara sadar sudah dihindari.

### 7.4 Degradasi
LLM mati → respons tetap `200`, tambahkan field `analyzer: "RULES_ONLY"`. Endpoint ini dipakai portal
publik (`api/careers.py`), sehingga tidak boleh mengembalikan 500 hanya karena gateway bermasalah.

### 7.5 Risiko dan mitigasi
| Risiko | Mitigasi |
|---|---|
| Biaya per klik | Cache hasil per hash `raw_text`; JD relatif pendek |
| LLM mengarang `matched_term` yang tidak ada di teks | Validasi: `matched_term` wajib ditemukan di `raw_text` (case-insensitive); kalau tidak, buang temuan |
| Inkonsistensi skor antar dua jalur | Wajib lewat `inclusivity_from_findings` (§7.3 butir 4) |
| Duplikasi temuan regex dan LLM | Dedupe `(category, matched_term)` |

### 7.6 Test
`backend/tests/test_bias_analysis_hybrid.py` (baru): (a) JD dengan kiasan → temuan LLM muncul,
`analyzer` bernilai `HYBRID`; (b) LLM mati → regex saja, `analyzer` bernilai `RULES_ONLY`, status 200;
(c) temuan duplikat → terdedupe; (d) `matched_term` halusinasi → dibuang; (e) skor hybrid identik
dengan skor hasil `inclusivity_from_findings` pada daftar temuan yang sama.

### 7.7 Bukti untuk juri
Demo JD berbahasa Indonesia yang lolos keempat regex tetapi ditangkap lapis LLM. Ini bukti penalaran
yang tidak bisa ditiru pencocokan kata kunci — inti indikator Inovasi (10%).

---

## 8. Ketergantungan dan Urutan Kerja

```
#8  independen            → kerjakan pertama (1 berkas baru + pengait)
#4  independen            → setelah #8
#3  menghasilkan teks bebas → butuh #8 sebagai penyaring
#5  menghasilkan teks bebas → butuh #8 sebagai penyaring
```

Urutan final: **#8 → #4 → #3 → #5**.

#5 dikerjakan paling akhir karena menyentuh endpoint publik yang sudah punya test (`api/careers.py`),
sehingga blast radius-nya paling besar. Bila waktu habis setelah #3, #5 cukup ditulis sebagai
rencana di proposal tanpa kode.

### Konfigurasi baru
| Setting | Default | Fungsi |
|---|---|---|
| `DUAL_MODEL_VERIFY` | `True` | Mengaktifkan item #4 |
| `LLM_CROSSCHECK_MODEL` | `ag/gemini-3.8-flash-high` | Model kedua untuk cross-check |
| `MODERATION_LLM_ENABLED` | `True` | Lapis klasifikasi item #8; `False` → `PATTERNS_ONLY` |
| `MODERATION_LLM_MIN_CHARS` | `300` | Panjang minimum sebelum klasifikasi LLM dipanggil; teks pendek cukup lapis pola |
| `BIAS_LLM_ANALYSIS` | `True` | Lapis LLM audit bias item #5; `False` → `RULES_ONLY` |

Ketiganya cukup ditambahkan di `core/config.py` dan `backend/.env.example`, mengikuti pola setting
yang sudah ada (`config.py:33-42`).

---

## 9. Di Luar Cakupan — Kandidat Future Development

Dua hal ini sengaja tidak dikerjakan sekarang dan sebaiknya ditulis sebagai rencana pengembangan
lanjutan di proposal, dengan alasan yang jujur.

### 9.1 Agentic tool loop (ReAct)
Pipeline sekarang berjalan 7 langkah lurus (`triage_service.py:285-295`) — model tidak pernah memilih
langkah atau tool berikutnya. Untuk memenuhi indikator Otonomi Agen (25%) secara penuh, perlu:
registry tool (`search_job_requirements`, `verify_github_repo`, `query_available_slots`,
`ask_recruiter_clarification`), loop keputusan model, dan penanganan kasus ambigu dengan bertanya
balik alih-alih menebak.

**Alasan ditunda:** mengubah inti pipeline menyentuh 224 test dan seluruh kontrak endpoint,
terlalu berisiko sehari sebelum submit.

### 9.2 Hybrid retrieval / RAG
Belum ada embedding sama sekali (0 hasil pencarian di seluruh repo). Pencocokan skill masih
lexical: exact match + dict 11 entri (`scoring.py:9-21`). Text JD belum pernah dibandingkan secara
semantik dengan isi CV.

**Alasan ditunda:** butuh penyimpanan vektor, migrasi skema, dan pengukuran ulang seluruh ambang
skor. Menulis "RAG akan ditambahkan" di rencana pengembangan lebih kuat daripada mengklaim RAG yang
sebenarnya belum ada — juri dapat memeriksa repositori.

---

## 10. Checklist Penerimaan

- [x] `backend/app/core/moderation.py` ada; tiga titik keluar tersambung; kutipan verbatim CV dikecualikan
- [x] Kejadian moderasi tercatat di `agent_steps` **tanpa** nilai enum baru
- [x] Cross-check dual-model berjalan paralel; `DUAL_MODEL_VERIFY=False` mengembalikan perilaku lama
- [x] Divergensi menurunkan `confidence_level` dan menaikkan `triage_priority`
- [x] Pertanyaan interview merujuk klaim nyata; `difficulty_level` selalu lolos ENUM
- [x] Fallback template lama masih hidup dan teruji
- [x] `analyzer` pada respons audit bias bernilai `HYBRID` atau `RULES_ONLY`, tidak pernah kosong
- [x] Skor inklusivitas tetap berasal dari `inclusivity_from_findings`
- [ ] `pytest backend/tests -q` → 224 passed lama tetap hijau, ditambah test baru
- [ ] Video demo memperlihatkan minimal satu skenario recovery otomatis (item #4)

---

## 11. Referensi Kode

| Berkas | Peran |
|---|---|
| `backend/app/core/triage_service.py` | Orkestrasi 7 siklus agen; tempat panggilan LLM tunggal |
| `backend/app/core/llm_adapter.py` | Gateway: retry, fallback model, cache deterministik |
| `backend/app/core/prompt.py` | System prompt ekstraksi + pertahanan injection |
| `backend/app/core/scoring.py` | Mesin skor deterministik, `inclusivity_from_findings`, template pertanyaan |
| `backend/app/schemas/extraction.py` | Skema Pydantic, `apply_substring_guard`, `_match_enum` |
| `backend/app/api/jobs.py` | Endpoint audit bias + simulasi kebijakan |
| `backend/app/api/candidates.py` | Upload, triage, trace SSE, review HITL, evidence graph |
| `backend/migrations/001_initial_schema.sql` | Definisi ENUM yang membatasi perubahan |

---

## 12. Catatan Implementasi

Ditulis setelah kode selesai, bukan sebagai rencana.

### 12.1 Berkas baru

| Berkas | Isi |
|---|---|
| `backend/app/core/moderation.py` | Dua lapis penyaring keluaran: pola deterministik + klasifikasi LLM opsional |
| `backend/app/core/crosscheck.py` | Perbandingan dua ekstraksi, ambang 0.70, penurunan confidence, baris anomali |
| `backend/app/core/interview_generator.py` | Generator pertanyaan wawancara + validasi enum/skill + moderasi |
| `backend/tests/test_output_moderation.py` | 11 test |
| `backend/tests/test_dual_model_crosscheck.py` | 12 test |
| `backend/tests/test_interview_generator.py` | 11 test |
| `backend/tests/test_bias_analysis_hybrid.py` | 8 test |

### 12.2 Berkas yang diubah

| Berkas | Perubahan |
|---|---|
| `backend/app/core/triage_service.py` | `_run_extraction_pair()` (dual-model paralel), `_generate_adaptive_assessments()`, eskalasi divergensi |
| `backend/app/core/broadcaster.py` | Choke point moderasi narasi + dua nama langkah baru di `INTERMEDIATE_TRIAGE_STEPS` |
| `backend/app/api/jobs.py` | Lapis LLM audit bias, validasi kutipan verbatim, dedupe, field `analyzer` |
| `backend/app/core/config.py` | Lima setting baru |
| `backend/tests/conftest.py` | Tiga flag AI dimatikan agar suite tidak menunggu gateway |
| `frontend/src/components/CandidateDetailPage.jsx` | Tab **Simulasi Wawancara AI** + label tingkat kesulitan + entri kamus anomali `LOW_CONFIDENCE_EXTRACTION` |
| `frontend/src/components/AgentTraceModal.jsx` | Chip konsensus dua model, daftar divergensi, target pertanyaan, peringatan moderasi; tangga langkah jadi 8 tahap |

### 12.3 Dua jebakan yang ditemukan saat implementasi

1. **Nama langkah SSE baru mematikan stream.** `publish()` menandai langkah sebagai terminal
   bila namanya tidak ada di `INTERMEDIATE_TRIAGE_STEPS` dan statusnya `completed`. Langkah
   `interview_generation` dan `crosscheck_verification` karena itu **wajib** didaftarkan,
   kalau tidak stream tutup sebelum `triage_completed`.
2. **`candidate_assessments` tidak punya kolom follow-up.** Pertanyaan lanjutan digabung ke
   `scenario_question` dengan penanda `Pertanyaan lanjutan:`. Frontend memecah teks itu untuk
   menampilkannya terpisah, sehingga tidak perlu migrasi `011`.

### 12.4 Bukti untuk video demo

1. Buka kandidat → tab **Simulasi Wawancara AI**: pertanyaan berbeda per kandidat, tiap
   pertanyaan menempel ke keahlian yang benar-benar ada di CV.
2. Buka **Agent Trace** → langkah 3 menampilkan chip `KONSENSUS DUA MODEL: 92% · STABIL`
   berikut nama kedua model.
3. Kandidat dengan CV ambigu → chip berubah `DIVERGEN`, confidence turun, prioritas menjadi
   `HIGH_ATTENTION`, dan anomali baru muncul di dossier.
4. Audit bias lowongan lewat API menampilkan `analyzer: "HYBRID"` dan temuan kiasan yang lolos
   dari keempat regex.
