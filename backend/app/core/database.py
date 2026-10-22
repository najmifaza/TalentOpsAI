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
    # Siklus koneksi lebih pendek dari wait_timeout server (300s). Tanpa ini,
    # koneksi idle di pool bisa dimatikan server lebih dulu dan request
    # berikutnya menerima "server has gone away" sebelum pre_ping sempat
    # menolongnya. Juga menjaga jumlah koneksi tiap worker tetap terbatas.
    pool_recycle=240,
    pool_size=5,
    max_overflow=5,
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
