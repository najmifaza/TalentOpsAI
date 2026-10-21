from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.config import settings
from .core.maintenance import start_background_tasks, stop_background_tasks
from .api.health import router as health_router
from .api.auth import router as auth_router
from .api.careers import router as careers_router
from .api.candidates import router as candidates_router
from .api.jobs import router as jobs_router
from .api.slots import router as slots_router
from .api.audit import router as audit_router
from .api.calendar_oauth import router as calendar_oauth_router

tags_metadata = [
    {
        "name": "Authentication & RBAC",
        "description": "Autentikasi pengguna berbasis JWT stateless dan manajemen role-based access control (Admin, Recruiter, Hiring Manager, Compliance Officer).",
    },
    {
        "name": "Public Career Portal",
        "description": "Endpoint publik untuk pelamar: pencarian lowongan kerja, pengunggahan berkas lamaran dengan DPA consent, pelacakan status anonim berbasis tracking token, dan penarikan lamaran mandiri (right to erasure).",
    },
    {
        "name": "HR Recruiter Candidate Management",
        "description": "Operasional recruiter internal: dropzone multi-file, daftar kandidat blind review, dossier teknis, pemicu autonomous agent triage, SSE trace stream, unmasking identitas, dan konfirmasi keputusan HITL.",
    },
    {
        "name": "Job Intelligence & Policy Simulation",
        "description": "Manajemen deskripsi pekerjaan, audit bias linguistik (FR-1 Job Analyzer), dan simulasi kebijakan What-If Policy Simulation Studio in-memory.",
    },
    {
        "name": "Calendar & Scheduling",
        "description": "Integrasi jadwal wawancara transaksional (Mock Calendar Adapter sandbox) dengan anti double-booking atomik dan penegakan interval non-overlap.",
    },
    {
        "name": "Compliance & Audit Trail",
        "description": "Jejak audit append-only yang tidak dapat dimodifikasi (tamper-evident) untuk kepatuhan UU No. 27/2022 (UU PDP) dan ISO 27001.",
    },
    {
        "name": "Health",
        "description": "Pemeriksaan kesiapan operasional backend FastAPI, engine MariaDB, dan gateway LLM.",
    },
]

# PRD Bab 6.3 & Bab 8.2: periodic maintenance runs on the event loop, not on request traffic.
@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = start_background_tasks()
    yield
    await stop_background_tasks(tasks)


app = FastAPI(
    title=f"{settings.APP_NAME} - Core Engine",
    version="2.5.2",
    lifespan=lifespan,
    description="""
# TalentOps AI: Human-Centric Agentic Recruitment Web Ecosystem

Backend Core Engine berbasis **FastAPI & MariaDB ACID** yang menghubungkan siklus rekrutmen otonom dengan pengawasan manusia mutlak (*Human-in-the-Loop*).

### Fitur Kunci Arsitektur:
* **Dual Ingestion Engine:** Jalur Public Career Portal (`/careers/apply`) dengan rate-limiting & two-way sanitization, serta HR Bulk Dropzone.
* **Kepatuhan Regulasi UU PDP No. 27/2022:** Envelope Encryption AES-256-GCM, blind index HMAC-SHA256, dan unified crypto-shredding right to erasure.
* **Deterministic 4D Scoring Engine:** Ekstraksi terstruktur single-pass via 9router Gateway (Gemini 3.8) pada suhu 0.0, anti-hallucination substring guard, dan scoring coverage deterministik Python.
* **Transaksional Anti Double-Booking Kalender:** Strict lock hierarchy (`users` -> `interview_slots` -> `candidates`) dan client-generated event ID untuk integrasi kalender tanpa tabrakan jadwal.
* **What-If Policy Simulation Studio:** Re-ranking kandidat dinamis berbasis slider in-memory tanpa memanggil ulang API LLM.
    """,
    openapi_tags=tags_metadata,
    contact={
        "name": "Tim Rekayasa TalentOps AI",
        "email": "engineering@talentops.id",
        "url": "https://api-talentops.fawt.biz.id",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https://(?:[a-z0-9-]+\.)*(?:vercel\.app|fawt\.biz\.id|ai\.id)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(careers_router, prefix="/api")
app.include_router(candidates_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(slots_router, prefix="/api")
app.include_router(calendar_oauth_router, prefix="/api")
app.include_router(audit_router, prefix="/api")


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "health": "/api/health",
        "version": "2.5.2",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
