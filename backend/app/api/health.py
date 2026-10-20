from fastapi import APIRouter
from sqlalchemy import text
from ..core.broadcaster import sse_broadcaster
from ..core.config import settings
from ..core.database import engine
from ..core.state import redis_state

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.head("/health")
async def health_check():
    db_status = "unknown"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        db_status = f"disconnected: {str(exc)}"

    # Shared-state backend matters for correctness: in-memory means SSE tickets and
    # the triage semaphore are per-process, so a multi-worker deploy is unsafe.
    redis_backend = await sse_broadcaster.backend_name()

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "demo_mode": settings.DEMO_MODE,
        "state_backend": redis_backend,
        "redis_configured": redis_state.configured,
        "multi_worker_safe": redis_backend == "redis",
    }
