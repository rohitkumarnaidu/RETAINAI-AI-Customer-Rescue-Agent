"""Application Settings and Configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


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

    LLM_PROVIDER: str = "gemini"
    LLM_MODEL: str = "gemini-2.5-flash"
    LLM_API_KEY: str = "mock_key_for_dev"

    API_V1_PREFIX: str = "/api/v1"

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

    @property
    def health_weights(self) -> HealthWeights:
        return HealthWeights(
            usage=self.HEALTH_WEIGHT_USAGE,
            support=self.HEALTH_WEIGHT_SUPPORT,
            sentiment=self.HEALTH_WEIGHT_SENTIMENT,
            engagement=self.HEALTH_WEIGHT_ENGAGEMENT,
        )


settings = Settings()
