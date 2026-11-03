import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    decode_access_token,
    get_current_user,
    revoke_token,
    security,
    verify_password,
)
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


class LoginRequest(BaseModel):
    username: str = Field(..., description="Username atau email terdaftar")
    password: str = Field(..., description="Password login")


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str


class LoginResponse(BaseModel):
    status: str
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    PRD Bab 8.1:
    Authenticates user and returns stateless HS256 JWT access token.
    Supports login via username or email.
    """
    ident = payload.username.strip()
    query = text("""
        SELECT id, username, email, password_hash, role, locked_until, failed_logins
        FROM users
        WHERE username = :ident OR email = :ident
    """)
    res = await db.execute(query, {"ident": ident})
    user = res.mappings().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_CREDENTIALS",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.utcnow()
    locked_until = user.get("locked_until")
    if locked_until:
        if isinstance(locked_until, str):
            try:
                locked_until = datetime.fromisoformat(locked_until)
            except ValueError:
                locked_until = None
        if locked_until:
            now_cmp = datetime.now(timezone.utc) if locked_until.tzinfo is not None else now
            if locked_until > now_cmp:
                remaining_seconds = max(1, int((locked_until - now_cmp).total_seconds()))
                remaining_minutes = max(1, (remaining_seconds + 59) // 60)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"ACCOUNT_LOCKED: Akun terkunci. Sisa waktu lock: {remaining_seconds} detik ({remaining_minutes} menit).",
                    headers={"Retry-After": str(remaining_seconds)},
                )

    if not verify_password(payload.password, user["password_hash"]):
        now_cmp = datetime.now(timezone.utc) if (locked_until and getattr(locked_until, "tzinfo", None) is not None) else now
        is_expired_lock = bool(locked_until and locked_until <= now_cmp)
        current_failed = 0 if is_expired_lock else (user.get("failed_logins") or 0)
        failed_logins = current_failed + 1

        if failed_logins >= 5:
            lock_until = now + timedelta(minutes=15)
            await db.execute(
                text("""
                    UPDATE users
                    SET failed_logins = :failed, locked_until = :locked_until
                    WHERE id = :user_id
                """),
                {
                    "failed": failed_logins,
                    "locked_until": lock_until,
                    "user_id": user["id"],
                },
            )
        else:
            await db.execute(
                text("""
                    UPDATE users
                    SET failed_logins = :failed, locked_until = NULL
                    WHERE id = :user_id
                """),
                {
                    "failed": failed_logins,
                    "user_id": user["id"],
                },
            )
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_CREDENTIALS",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await db.execute(
        text("""
            UPDATE users
            SET failed_logins = 0, locked_until = NULL
            WHERE id = :user_id
        """),
        {"user_id": user["id"]},
    )
    await db.commit()

    token_data = {
        "sub": str(user["id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }
    access_token = create_access_token(token_data)

    return {
        "status": "success",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
        },
    }


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns authenticated user's current identity and RBAC role.
    """
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user["role"],
    }


@router.post("/logout")
async def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
):
    """
    Revokes access token and invalidates session.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NOT_AUTHENTICATED_MISSING_TOKEN",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    jti = payload.get("jti")
    if jti:
        revoke_token(jti, exp=payload.get("exp"))

    return {"status": "logged_out"}
