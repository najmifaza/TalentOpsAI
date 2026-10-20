import json
import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "TalentOps AI Backend"
    APP_ENV: str = "production"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://talentops.vercel.app",
        "https://talentops.fawt.biz.id",
    ]

    DATABASE_URL: str = "mysql+aiomysql://talentops_app:***@127.0.0.1:3306/talentops_db"
    SYNC_DATABASE_URL: str = "mysql+pymysql://talentops_app:***@127.0.0.1:3306/talentops_db"

    MASTER_KEK: str = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
    HMAC_PEPPER: str = "talentops_hmac_secret_pepper_2026"
    JWT_SECRET: str = "talentops_jwt_secret_dev_key_super_secure_32bytes"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    LLM_ROUTER_BASE_URL: str = "http://127.0.0.1:20128/v1"
    LLM_ROUTER_API_KEY: str = ""
    LLM_API_KEY: str = os.getenv("LLM_API_KEY") or os.getenv("CUSTOM_API_KEY", "")
    LLM_ROUTER_PROVIDER: str = "antigravity"
    LLM_MODEL_NAME: str = "ag/gemini-3.8-flash-low"
    LLM_FALLBACK_MODEL: str = "ag/gemini-3.8-flash-high"
    LLM_TEMPERATURE: float = 0.0
    LLM_THINKING_LEVEL: str = "low"
    LLM_TIMEOUT: float = 30.0
    LLM_MAX_RETRIES: int = 3

    GITHUB_TOKEN: str = ""
    DEMO_MODE: bool = False

    # Multi-worker state backend (SSE broadcaster, tickets, triage semaphore).
    # Empty string or unreachable Redis => graceful in-memory fallback (single-worker only).
    REDIS_URL: str = ""
    REDIS_KEY_PREFIX: str = "talentops"
    TRIAGE_CONCURRENCY_LIMIT: int = 3
    SSE_HISTORY_MAX_EVENTS: int = 200

    # --- Google Calendar OAuth2 (live two-way sync) -------------------------
    # Left empty => adapter stays in sandbox mode and no outbound call is made.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/calendar/oauth/callback"
    GOOGLE_CALENDAR_ID: str = "primary"
    GOOGLE_CALENDAR_SCOPES: List[str] = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
    ]
    GOOGLE_OAUTH_AUTH_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_OAUTH_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    GOOGLE_CALENDAR_API_BASE: str = "https://www.googleapis.com/calendar/v3"
    GOOGLE_HTTP_TIMEOUT: float = 15.0
    # Frontend page the OAuth callback redirects back to (no tokens in the URL).
    OAUTH_SUCCESS_REDIRECT: str = "https://talentops.vercel.app/admin/dashboard"

    # --- Transactional email (Resend) --------------------------------------
    # provider: "resend_api" (HTTPS) | "resend_smtp" (SMTP relay) | "" (disabled)
    EMAIL_PROVIDER: str = ""
    RESEND_API_KEY: str = ""
    RESEND_SMTP_HOST: str = "smtp.resend.com"
    RESEND_SMTP_PORT: int = 465
    RESEND_SMTP_USER: str = "resend"
    EMAIL_FROM: str = "TalentOps AI <noreply@talentops.fawt.biz.id>"
    EMAIL_REPLY_TO: str = ""
    EMAIL_TIMEOUT: float = 15.0
    EMAIL_MAX_RETRIES: int = 2

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
