import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, Optional, Tuple
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

# HTTPBearer security scheme for OpenAPI and FastAPI
security = HTTPBearer(auto_error=False)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding < 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def create_access_token(data: Dict[str, Any], expires_seconds: Optional[int] = None) -> str:
    """Creates HS256 JWT using stdlib HMAC-SHA256."""
    payload = data.copy()
    exp = int(time.time()) + (expires_seconds if expires_seconds is not None else settings.JWT_EXPIRE_MINUTES * 60)
    payload["exp"] = exp
    payload["iat"] = int(time.time())

    header = {"alg": settings.JWT_ALGORITHM, "typ": "JWT"}
    h_bytes = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_bytes = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_bytes}.{p_bytes}".encode("utf-8")
    sig = hmac.new(settings.JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    s_bytes = _b64url_encode(sig)
    return f"{h_bytes}.{p_bytes}.{s_bytes}"


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates HS256 JWT token signature and expiry."""
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN_FORMAT",
            headers={"WWW-Authenticate": "Bearer"},
        )
    h_b64, p_b64, s_b64 = parts
    signing_input = f"{h_b64}.{p_b64}".encode("utf-8")
    expected_sig = hmac.new(settings.JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    try:
        actual_sig = _b64url_decode(s_b64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN_ENCODING",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN_SIGNATURE",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN_PAYLOAD",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if "exp" in payload and time.time() > payload["exp"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="TOKEN_EXPIRED",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies password against stored PBKDF2-HMAC-SHA256 hash."""
    if not hashed_password or not hashed_password.startswith("pbkdf2:"):
        return False
    try:
        _, salt_hex, hash_hex = hashed_password.split(":")
        calc = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), bytes.fromhex(salt_hex), 100_000).hex()
        return hmac.compare_digest(calc, hash_hex)
    except Exception:
        return False


def hash_password(plain_password: str) -> str:
    """Hashes password with PBKDF2-HMAC-SHA256."""
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt, 100_000).hex()
    return f"pbkdf2:{salt.hex()}:{derived}"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Extracts and authenticates current user via Bearer JWT.
    Enforces DEMO_MODE fallback for developer convenience if token omitted.
    """
    if not credentials:
        # ponytail: dev convenience in DEMO_MODE defaults to recruiter (id=1); upgrade to strict auth in prod
        if settings.DEMO_MODE:
            return {
                "id": 1,
                "username": "recruiter_talentops",
                "email": "recruiter@talentops.ai",
                "role": "recruiter",
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NOT_AUTHENTICATED_MISSING_TOKEN",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN_SUB",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        res = await db.execute(
            text("SELECT id, username, email, role FROM users WHERE id = :uid"),
            {"uid": int(user_id)},
        )
        row = res.mappings().first()
        if row:
            return dict(row)
    except Exception:
        pass

    return {
        "id": int(user_id),
        "username": payload.get("username", f"user_{user_id}"),
        "email": payload.get("email", ""),
        "role": payload.get("role", "recruiter"),
    }


def require_roles(*allowed_roles: str):
    """Factory dependency for Role-Based Access Control (RBAC)."""
    async def role_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
    ) -> Dict[str, Any]:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"FORBIDDEN_INSUFFICIENT_PERMISSIONS: role '{user_role}' not in {list(allowed_roles)}",
            )
        return current_user

    return role_checker
