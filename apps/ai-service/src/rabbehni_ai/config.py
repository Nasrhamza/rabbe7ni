from functools import lru_cache
from typing import Literal

from pydantic import HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    node_env: Literal["development", "test", "production"] = "development"
    log_level: Literal["debug", "info", "warning", "error", "critical"] = "info"
    service_version: str = "0.0.0"
    otel_exporter_otlp_endpoint: HttpUrl | None = None
    internal_service_token: str = "rabbehni-local-internal-token"
    ai_provider: Literal["local", "remote"] = "local"
    ai_provider_url: HttpUrl | None = None
    ai_provider_timeout_seconds: float = 5.0
    ai_model_version: str = "rabbehni-deterministic-v1"
    ai_prompt_version: str = "analytics-explanation-v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
