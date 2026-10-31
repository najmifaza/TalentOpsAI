# AUDIT REPORT: AI Prompts, Token Efficiency, JSON Extraction Schema, & Evidence Traceability

Tanggal Audit: 31 Oktober 2026  
Ruang Lingkup Target:
- `backend/app/core/prompt.py`
- `backend/app/core/llm_adapter.py`
- `backend/tests/test_prompt_token_efficiency.py`
- Komponen Terkait: `backend/app/schemas/extraction.py`, `backend/app/core/triage_service.py`, `backend/tests/test_evidence_traceability.py`

---

## 1. Executive Summary & Audit Scorecard

| Area Evaluasi | Status / Tingkat Risiko | Temuan Utama |
|---|---|---|
| **AI Prompts & Guardrails** | **SEDANG (Medium Risk)** | Sanitasi prompt injection parsial (`replace` tag teks tanpa escaping karakter kontrol regex/JSON); tidak ada instruksi pembatasan kuantitas claim (rentan unconstrained expansion). |
| **Token Efficiency & Budget** | **RENDAH (Low Risk)** | Baseline overhead ~220-250 tokens per call (sesuai target batas <= 600 tokens); rata-rata prompt CV utuh ~1000-1400 tokens (di bawah batas budget 2000 tokens). |
| **JSON Extraction Schema & Robustness** | **SEDANG (Medium Risk)** | Fungsi pembersih markdown code fences (`clean_llm_json_response`) rapuh terhadap teks pengantar/penutup di luar fence; skema output prompt mencantumkan `github_url` & `portfolio_url` nullable namun format skema contoh prompt statis tanpa panduan penanganan multi-role. |
| **Evidence Traceability & Anti-Hallucination** | **SEDANG (Medium Risk)** | `apply_substring_guard` sensitif terhadap perubahan spasi ganda, koma/titik tanda baca, dan OCR anomaly; ketika model melakukan parafrase minimal 1 kata, seluruh claim detail di-drop tanpa fuzzy alignment. |

---

## 2. Analisis Mendalam per Komponen

### A. AI Prompts (`backend/app/core/prompt.py`)

#### 1. Celah Delimiter & Prompt Injection Bypass
- **Temuan**:
  Pada `build_extraction_prompt`:
  ```python
  safe_text = (
      sanitized_text.replace("</candidate_resume_untrusted>", "&lt;/candidate_resume_untrusted&gt;")
      .replace("<candidate_resume_untrusted>", "&lt;candidate_resume_untrusted&gt;")
      .strip()
  )
  ```
  Hanya melakukan sanitasi hardcoded tag `<candidate_resume_untrusted>`.
- **Celah**:
  - Variasi casing seperti `</Candidate_Resume_Untrusted>` atau variasi karakter spasi (`</ candidate_resume_untrusted >`) tidak tertangkap.
  - Serangan injection berbasis delimiter alternatif (`"""`, ```` ```json ````, atau peniruan role `System:` / `User:`) dapat memutus parsing context model LLM jika model router tidak mengisolasi konteks via schema formatting ketat.
- **Rekomendasi**: Gunakan case-insensitive regex sanitasi untuk tag delimiter, atau tambahkan payload role delimitasi standar sistem AI.

#### 2. Ketiadaan Batas Maksimal Ekstraksi Claims (Token Bloat Risiko)
- **Temuan**:
  Prompt tidak mendefinisikan batasan jumlah klaim (`claims`) yang diekstraksi. Untuk resume panjang (3-5 halaman), model berpotensi mengekstraksi 40-60 claims sepele (misal: "Microsoft Word", "Zoom", "Email").
- **Dampak**: Respon output membengkak melewati 1500 tokens, meningkatkan latency gateway > 10 detik dan memicu gateway timeout (timeout adapter disetel 12 detik).
- **Rekomendasi**: Batasi prompt ke `Max 10-15 most significant technical skills and operational achievements relevant to software engineering`.

#### 3. Kepatuhan Regulasi Anti-Bias (UU Ketenagakerjaan No.13/2003)
- **Status**: Bagus.
- Prompt secara eksplisit menginstruksikan `NEVER extract university name or accreditation`. Skema Pydantic `EducationItem` juga menerapkan `extra="forbid"` tanpa field almamater/institusi, mencegah kebocoran data bias kampus.

---

### B. LLM Gateway & Token Efficiency (`backend/app/core/llm_adapter.py` & `backend/tests/test_prompt_token_efficiency.py`)

#### 1. Robustness Regex Pembersih JSON (`clean_llm_json_response`)
- **Temuan**:
  ```python
  cleaned = raw_text.strip()
  cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
  cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
  return cleaned.strip()
  ```
- **Celah**:
  - Bila LLM mengembalikan teks pembuka/pengantar seperti:
    `Here is the extracted JSON output:\n```json\n{...}\n```\nHope this helps!`
    Regex dengan `flags=re.MULTILINE` hanya menghapus baris pembuka dan penutup code block, menyisakan teks pengantar dan teks penutup. Akibatnya `json.loads(clean_json_str)` memicu `json.decoder.JSONDecodeError`, memaksa triage langsung jatuh ke `_extract_heuristic_fallback`.
- **Rekomendasi**:
  Ekstrak blok JSON dengan mencari indeks kurung kurawal terluar (`{` pertama hingga `}` terakhir) atau regex non-greedy `re.search(r"(\{.*\})", raw_text, re.DOTALL)`.

#### 2. Konfigurasi `response_format` pada Adapter
- **Temuan**:
  `LLMAdapter.complete` memiliki parameter `response_format: dict[str, Any] | None = None`. Namun pada `triage_service.py` pemanggilan `complete()` tidak mengirimkan `response_format={"type": "json_object"}`.
- **Dampak**: Model LLM default mengembalikan plain markdown format yang rentan terhadap markdown conversational fluff jika prompt instruction mengalami degradasi attention.
- **Rekomendasi**: Selalu pasang `response_format={"type": "json_object"}` pada pemanggilan `complete()` untuk extraction pipeline.

#### 3. Token Economy & Budget
- **Status**: Sesuai Standar PRD Bab 4.3 & Sprint 5 DoD.
- Prompt System + User overhead adalah ~230 tokens (~920 karakter), berada jauh di bawah batas ketat 600 tokens.
- Total estimasi input token untuk CV golden dataset berkisar 850 - 1450 tokens, aman dalam batas 2000 tokens per CV.

---

### C. Skema Ekstraksi JSON & Traceability (`backend/app/schemas/extraction.py`)

#### 1. Substring Guard & Masalah Normalisasi Karakter
- **Temuan**:
  `CandidateExtractionSchema.apply_substring_guard()` memvalidasi:
  ```python
  normalized_cv = " ".join(sanitized_cv_text.lower().split())
  ...
  narrative = (claim.context_narrative or "").strip().lower()
  norm_narrative = " ".join(narrative.split())
  if norm_narrative and norm_narrative not in normalized_cv:
      claim.has_implementation_detail = False
      claim.context_narrative = None
      claim.metric_string = None
  ```
- **Celah**:
  - **Tanda Baca & Hyphenasi**: Jika CV memiliki strip/tanda petik miring (curly quotes `“`, hyphen `-`, dash `–`, bullet point `•`), dan model menormalkannya menjadi tanda petik lurus atau menghapus tanda hubung, pengecekan `norm_narrative not in normalized_cv` langsung gagal (`False Positive Downgrade`).
  - **Parafrase Model**: Model Gemini sering kali memperbaiki tipografi atau kapitalisasi kecil, menyebabkan klaim riil kandidat didiskualifikasi dari score evidence graph.
- **Rekomendasi**: Strip tanda baca non-alfanumerik dasar (`re.sub(r"[^\w\s]", "", ... )`) sebelum matching substring.

#### 2. Keamanan Parsing Timeline & Null Coercion
- **Status**: Sangat Kuat (Hardened).
- `field_validator` untuk `employment_type` dan `graduation_status` telah mengimplementasikan lookup toleran (`_match_enum`) dan alias mapping. Nilai tak terduga tidak melempar pydantic `ValidationError`, melainkan fallback aman sehingga candidate profiling tidak gugur ke mode heuristik mentah.

---

## 3. Matriks Rekomendasi Perbaikan Prioritas

| ID | Prioritas | Komponen | Tindakan Korektif |
|---|---|---|---|
| **FIX-01** | **Tinggi (P1)** | `app/core/prompt.py` | Perbaiki `clean_llm_json_response` dengan slicing kurung `{` terluar dan regex fallback agar aman dari conversational text LLM. |
| **FIX-02** | **Tinggi (P1)** | `app/core/triage_service.py` | Teruskan `response_format={"type": "json_object"}` saat memanggil `llm_adapter.complete`. |
| **FIX-03** | **Sedang (P2)** | `app/schemas/extraction.py` | Tambahkan sanitasi tanda baca (punctuation stripping) pada `apply_substring_guard` sebelum substring evaluation. |
| **FIX-04** | **Sedang (P2)** | `app/core/prompt.py` | Pasang batas jumlah klaim teknis maksimal (15 skills relevan) pada instruksi prompt untuk mencegah token bloat. |
| **FIX-05** | **Rendah (P3)** | `app/core/prompt.py` | Gunakan regex case-insensitive untuk isolasi tag `<candidate_resume_untrusted>`. |
