# WORKLOG - FARDIZZA (AI AGENT LOGIC, SCORING & EVALUATION)

Peran: Developer 2  
Tanggung Jawab: Model Adapter Layer 9router (Gemini 3.8), Skema Validasi Pydantic v2, Anti-Hallucination Substring Guard, Golden Testing Dataset Generator, Evaluasi & Benchmarking.

---

### 2026-10-17 - Fardizza - Fondasi AI Engine & Ekstraksi Terstruktur (Sprint 1)
- **Komponen / File:**
  - `backend/app/core/config.py`
  - `backend/app/core/llm_adapter.py`
  - `backend/app/core/prompt.py`
  - `backend/app/core/hidden_text_detector.py`
  - `backend/app/schemas/extraction.py`
  - `backend/data/generate_initial_dataset.py`
  - `backend/data/golden_dataset/` (5 CV format .txt & .docx + `pre_cached_fixtures.json`)
  - `backend/tests/test_llm_adapter.py`
  - `backend/tests/test_extraction_schema.py`
  - `backend/tests/test_golden_dataset_extraction.py`
  - `backend/.env.example`
- **Yang Dikerjakan:**
  - Setup Adaptive Model Adapter Layer mengonsumsi 9router Gateway (`http://localhost:20128/v1`) dengan model `gemini-3.8-flash-low` (default) & fallback `gemini-3.8-flash-high`, Suhu 0.0, Thinking Level `low`.
  - Implementasi mekanisme ketahanan jaringan: exponential backoff retries, model failover, dan deterministic pre-cached mode berbasis `file_hash` SHA-256 untuk offline live demo yang stabil.
  - Implementasi skema ekstraksi terstruktur Pydantic v2 (`CandidateExtractionSchema`, `ClaimItem`, `CareerTimelineItem`, `EducationItem`, `AnomalyFlags`) dengan aturan ketat:
    - *Anti-Bias Almamater:* Melarang atribut nama universitas/kampus dan akreditasi (`extra="forbid"`).
    - *Anti-Hallucination Substring Guard:* Memvalidasi narasi implementasi terhadap teks resume asli, otomatis menurunkan klaim halusinasi jika tidak ditemukan di teks CV.
  - Rekayasa prompt *Single-Pass Extraction* dengan pembungkusan delimiter XML `<candidate_resume_untrusted>` untuk mencegah *Indirect Prompt Injection*.
  - Pembuatan modul pendeteksi teks tersembunyi DOCX (`audit_docx_hidden_text`) yang memindai tag `w:vanish`, `w:hidden`, font $\le 1\text{pt}$, dan font RGB putih (#FFFFFF).
  - Penyusunan **5 Berkas Resume Sintetis Awal (Golden Dataset Baseline)** dalam format `.txt` dan `.docx`:
    1. Budi Santoso (Strong Match - Backend 5 thn, valid metrics).
    2. Reza Pratama (Review Required - Overlap karier 17 bulan).
    3. Citra Lestari (Weak Fit - Latar belakang DKV non-programmer).
    4. Dewi Sartika (Security Quarantine - Injeksi teks tersembunyi `w:vanish`).
    5. Eko Prasetyo (Fairness Evaluation - Legitimate career break keluarga).
  - Penyiapan fixture JSON pre-cached untuk integrasi walking skeleton frontend/backend.
- **Status & Verifikasi:** Selesai 100%. Seluruh test suite mandiri lulus (`test_llm_adapter.py`, `test_extraction_schema.py`, `test_golden_dataset_extraction.py`). Pull Request `feat/ai-engine` telah diajukan ke branch `main`.
- **Catatan untuk Backend (Najmi):**
  - *Integrasi Config:* Nilai setting LLM (`LLM_ROUTER_BASE_URL`, `LLM_MODEL_NAME`, `LLM_API_KEY`, dll.) siap digabungkan ke `Settings` Pydantic BaseSettings utama.
  - *Output Model AI:* Seluruh payload hasil ekstraksi LLM dijamin selalu dibungkus ke dalam objek `CandidateExtractionSchema` sebelum diproses ke MariaDB/kalkulasi skor.
- **Rencana Selanjutnya (Sprint 2):**
  - Implementasi modul kalkulasi matematis *Deterministic 4D Scoring Engine* ($S_{\text{comp}}, S_{\text{port}}, S_{\text{conf}}, S_{\text{risk}}$).
  - Logika evaluasi hierarkis *Agent Decision Points* (`STRONG_MATCH`, `REVIEW_REQUIRED`, `WEAK_FIT`).
