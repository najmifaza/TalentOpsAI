import json
import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "TalentOps AI Backend"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://talentops.vercel.app",
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
    DEMO_MODE: bool = True

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
