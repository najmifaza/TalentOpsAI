import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    LLM_ROUTER_BASE_URL: str = os.getenv("LLM_ROUTER_BASE_URL", "http://localhost:20128/v1")
    LLM_ROUTER_PROVIDER: str = os.getenv("LLM_ROUTER_PROVIDER", "antigravity")
    LLM_MODEL_NAME: str = os.getenv("LLM_MODEL_NAME", "ag/gemini-3.8-flash-low")
    LLM_FALLBACK_MODEL: str = os.getenv("LLM_FALLBACK_MODEL", "ag/gemini-3.8-flash-high")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.0"))
    LLM_THINKING_LEVEL: str = os.getenv("LLM_THINKING_LEVEL", "low")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY") or os.getenv("CUSTOM_API_KEY", "")
    LLM_TIMEOUT: float = float(os.getenv("LLM_TIMEOUT", "30.0"))
    LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "3"))

settings = Settings()
