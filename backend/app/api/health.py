from fastapi import APIRouter
from sqlalchemy import text
from ..core.config import settings
from ..core.database import engine

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

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "demo_mode": settings.DEMO_MODE,
    }
