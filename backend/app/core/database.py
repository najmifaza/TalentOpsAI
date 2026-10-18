from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

# Fix upstream aiomysql bug with PyMySQL 1.2+ where escape_bytes_prefixed is string instead of callable
try:
    import pymysql.converters
    if not callable(getattr(pymysql.converters, "escape_bytes_prefixed", None)):
        pymysql.converters.escape_bytes_prefixed = pymysql.converters.escape_bytes
except Exception:
    pass

from .config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
