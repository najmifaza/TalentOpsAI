# TalentOps AI

Human-centric agentic recruitment ecosystem: an autonomous agent investigates a
candidate dossier, scores it deterministically, and stops at a Human-in-the-Loop gate
before anything is dispatched. Built for **GTNIC 2026 (AI Agent Development)** and
**UINIC 8.0 (Web Development)**.

- Live web: https://talentops.ai.id
- Backend API: https://api.talentops.ai.id
- Product requirement document: [`docs/PRD_TALENTOPS_AI_MASTER.md`](docs/PRD_TALENTOPS_AI_MASTER.md)
- Remaining-work log (honest gaps): [`docs/STATUS_PEKERJAAN_BELUM_SELESAI.md`](docs/STATUS_PEKERJAAN_BELUM_SELESAI.md)

## What the agent actually does

Seven autonomously executed cycles per candidate (`backend/app/core/triage_service.py`):

1. Ingestion + magic-byte validation (PDF `%PDF-`, DOCX `PK\x03\x04`)
2. Hidden-text / prompt-injection audit (`core/hidden_text_detector.py`) — PDF render mode 3, near-white text, ≤1pt glyphs, DOCX `w:vanish` / `w:hidden`
3. Structured extraction via 9router → Gemini 3.8, strict Pydantic schema
4. Anti-hallucination substring guard (unverified narrative is nulled, tier dropped)
5. GitHub portfolio verification (SSRF-guarded, programmer roles only)
6. Deterministic 4D scoring — SKILL 40 / EXPERIENCE 30 / EDUCATION 10 / PORTFOLIO 20 — plus timeline overlap & title-inflation audit (`core/scoring.py`)
7. Adaptive gap-based challenge + tentative calendar lock, then stop at `waiting_approval`

Every step is streamed over SSE (single-use 60 s ticket) and written to `agent_steps`.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18.3, Vite 5.4, Tailwind 3.4, @xyflow/react (React Flow 12) |
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy async (`aiomysql`) |
| Database | MariaDB 10.11 / InnoDB, 14 tables, 3NF (`backend/migrations`) |
| Crypto | AES-256-GCM envelope encryption (DEK/KEK), HMAC-SHA256 blind index |
| Auth | JWT + in-memory blacklist, PBKDF2-HMAC-SHA256 (100k), 5-fail/15-min lock |
| LLM | 9router gateway (`LLM_ROUTER_BASE_URL`), model + fallback via env |
| Proxy | Nginx: TLS, HTTP/2, gzip, rate limit 5 r/m on public apply |

## Quickstart

```bash
# Backend
cd backend
python -m venv ../.venv && ../.venv/Scripts/activate      # Windows
pip install -r requirements.txt
cp .env.example .env        # fill DATABASE_URL, MASTER_KEK, HMAC_PEPPER, JWT_SECRET
python scripts/init_db.py   # applies backend/migrations/*.sql in order
SEED_DEFAULT_PASSWORD='<strong-password>' python scripts/seed_data.py
uvicorn app.main:app --reload --port 8002

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Tests (no database needed; DB-touching tests use fakes/in-memory):

```bash
cd backend && ../.venv/Scripts/python.exe -m pytest -q
```

## Repository layout

```
backend/app/api/         REST endpoints (auth, careers, candidates, jobs, slots, blog, audit)
backend/app/core/        agent orchestration, scoring, crypto, sanitizer, detectors, erasure
backend/app/adapters/    GitHub REST + calendar adapters
backend/migrations/      DDL 001–010, applied by scripts/init_db.py
backend/data/            golden dataset: 25 synthetic CVs + 4 pre-cached fixtures
backend/tests/           pytest suite
frontend/src/            React app (careers portal, HR dashboard, evidence graph, what-if studio)
nginx/                   production reverse-proxy config
docs/                    PRD, status log, worklogs, competition documents
```

## Operational constraints (read before deploying)

- **One Uvicorn worker.** No Redis in the deployed topology, so SSE tickets and the
  triage semaphore are per-process. `--workers 2` silently breaks the trace stream.
- **No external credentials are committed.** `GOOGLE_CLIENT_ID`/`SECRET` and
  `RESEND_API_KEY` are empty by default; the calendar and email paths report their
  real status instead of pretending to work.
- **`DEMO_PURGE_ENABLED` is `False`.** The 4-hour purge deletes *every* candidate,
  including the judging dataset; it only becomes safe with an `is_demo` column.
- **Use synthetic data** for any public demo. `DemoDataBanner` reminds users of this.

## Data protection

Candidate identity is encrypted per record (AES-256-GCM, unique DEK wrapped by the
master KEK). Right to erasure shreds the DEK and overwrites the blind index
(`core/erasure.py`), leaving the audit trail intact. Unmasking is blocked during blind
review and every access is written to `pii_access_logs`.