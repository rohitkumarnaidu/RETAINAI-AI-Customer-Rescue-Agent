"""Application Settings and Configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from typing import Any
import json


class HealthWeights(BaseSettings):
    """Configurable weights for multi-dimensional health model."""
    usage: float = 0.40
    support: float = 0.30
    sentiment: float = 0.20
    engagement: float = 0.10


class Settings(BaseSettings):
    """Master Application Configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "RETAINAI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000

    DATABASE_URL: str = "sqlite+aiosqlite:///./retainai.db"

    LLM_PROVIDER: str = "groq"  # groq | openai/gpt | gemini — groq LPU fastest (mock disabled on live branch)
    LLM_MODEL: str = "openai/gpt-oss-120b"  # groq production (Aug 2026): openai/gpt-oss-120b ~500tps $0.15/$0.60 | openai/gpt-oss-20b ~1000tps $0.075/$0.30 — legacy llama-3.3-70b/llama-3.1-8b shutdown 16 Aug 2026
    LLM_API_KEY: str = ""  # LIVE BRANCH: must be provided via .env / env var / GROQ_API_KEY / OPENAI_API_KEY — mock_key_for_dev disabled, no mock fallback
    GROQ_API_KEY: str = ""  # alias for LLM_API_KEY when provider=groq (gsk_...) — live branch requires real key
    OPENAI_API_KEY: str = ""  # alias when provider=openai/gpt (sk-...) — live branch requires real key

    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: Any = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])
    DEMO_MODE: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            # Try JSON array first: ["http://...","http://..."]
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if str(x).strip()]
            except Exception:
                pass
            # Fallback: comma-separated string (Render dashboard often sets as comma list without JSON)
            # Also handle single value without comma
            if "," in v:
                return [s.strip() for s in v.split(",") if s.strip()]
            return [v]
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return v
    LOG_LEVEL: str = "INFO"
    AUTH_ENABLED: bool = False
    AUTH_SECRET: str = "retainai-dev-secret-change-in-prod"
    JWT_SECRET: str = "retainai-dev-secret-change-in-prod"
    APP_SECRET_KEY: str = "retainai-dev-app-secret-change-in-prod-32chars"
    DEMO_API_KEY: str = "demo-key-retainai-2026"
    API_KEY: str = "demo-key-retainai-2026"
    DEMO_TENANT_ID: str = "demo-tenant-001"
    DEMO_ORG_KEY: str = "demo-org-key-001"
    FEATURE_TENANCY: bool = False
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # Timeouts & Retry (S62/S63)
    AGENT_TIMEOUT: int = 60
    LLM_TIMEOUT: float = 10.0
    LLM_MAX_RETRIES: int = 2
    DB_TIMEOUT: float = 5.0

    # Dynamic System Prompt (S: Make system prompts configurable / dynamic)
    INVESTIGATION_SYSTEM_PROMPT: str = ""
    ACTION_SYSTEM_PROMPT: str = ""

    # Health Weights Engine Config
    HEALTH_WEIGHT_USAGE: float = 0.40
    HEALTH_WEIGHT_SUPPORT: float = 0.30
    HEALTH_WEIGHT_SENTIMENT: float = 0.20
    HEALTH_WEIGHT_ENGAGEMENT: float = 0.10

    # Risk Thresholds
    RISK_CRITICAL_THRESHOLD: float = 20.0
    RISK_HIGH_THRESHOLD: float = 40.0
    RISK_AT_RISK_THRESHOLD: float = 60.0
    RISK_WATCH_THRESHOLD: float = 80.0
    RISK_HEALTHY_THRESHOLD: float = 90.0

    @property
    def health_weights(self) -> HealthWeights:
        return HealthWeights(
            usage=self.HEALTH_WEIGHT_USAGE,
            support=self.HEALTH_WEIGHT_SUPPORT,
            sentiment=self.HEALTH_WEIGHT_SENTIMENT,
            engagement=self.HEALTH_WEIGHT_ENGAGEMENT,
        )


settings = Settings()
