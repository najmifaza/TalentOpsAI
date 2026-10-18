from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api.health import router as health_router
from .api.careers import router as careers_router
from .api.candidates import router as candidates_router
from .api.jobs import router as jobs_router

app = FastAPI(
    title=settings.APP_NAME,
    version="2.5.2",
    description="Human-Centric Agentic Recruitment Web Ecosystem - Backend Core Engine",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(careers_router, prefix="/api")
app.include_router(candidates_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")


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
