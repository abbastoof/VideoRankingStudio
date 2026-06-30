"""Runtime configuration. Validated at boot; failure to load is fatal."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Runtime
    node_env: Literal["development", "test", "staging", "production"] = Field("development", alias="NODE_ENV")
    log_level: str = Field("info", alias="LOG_LEVEL")
    tz: str = Field("UTC", alias="TZ")

    # Service URLs
    api_url: str = Field(..., alias="API_URL")
    web_url: str = Field(..., alias="WEB_URL")

    # Database (shared with API)
    database_url: str = Field(..., alias="DATABASE_URL")

    # Redis (cache + result backend + pubsub)
    redis_url: str = Field(..., alias="REDIS_URL")

    # Broker
    broker_url: str = Field(..., alias="BROKER_URL")
    broker_result_backend: str = Field("redis://localhost:6379/2", alias="BROKER_RESULT_BACKEND")

    # Storage (S3 / MinIO)
    s3_endpoint: str | None = Field(None, alias="S3_ENDPOINT")
    s3_region: str = Field("us-east-1", alias="S3_REGION")
    s3_access_key_id: str = Field(..., alias="S3_ACCESS_KEY_ID")
    s3_secret_access_key: str = Field(..., alias="S3_SECRET_ACCESS_KEY")
    s3_force_path_style: bool = Field(False, alias="S3_FORCE_PATH_STYLE")
    s3_bucket_uploads: str = Field(..., alias="S3_BUCKET_UPLOADS")
    s3_bucket_generated: str = Field(..., alias="S3_BUCKET_GENERATED")
    s3_bucket_exports: str = Field(..., alias="S3_BUCKET_EXPORTS")
    s3_bucket_public: str = Field(..., alias="S3_BUCKET_PUBLIC")

    # Internal auth (worker → API callbacks)
    internal_service_token: str = Field(..., alias="INTERNAL_SERVICE_TOKEN")

    # AI providers (optional; tasks fail gracefully if missing the one they need)
    llm_provider: Literal["anthropic", "openai", "local"] = Field("anthropic", alias="LLM_PROVIDER")
    anthropic_api_key: str | None = Field(None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field("claude-sonnet-4-6", alias="ANTHROPIC_MODEL")
    openai_api_key: str | None = Field(None, alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4o", alias="OPENAI_MODEL")

    tts_provider: Literal["elevenlabs", "azure", "polly", "coqui"] = Field("elevenlabs", alias="TTS_PROVIDER")
    elevenlabs_api_key: str | None = Field(None, alias="ELEVENLABS_API_KEY")
    elevenlabs_default_voice_id: str | None = Field(None, alias="ELEVENLABS_DEFAULT_VOICE_ID")

    stt_provider: Literal["openai_whisper", "local_whisper", "google", "deepgram"] = Field(
        "openai_whisper", alias="STT_PROVIDER"
    )
    deepgram_api_key: str | None = Field(None, alias="DEEPGRAM_API_KEY")
    local_whisper_model: str = Field("base", alias="LOCAL_WHISPER_MODEL")
    local_whisper_device: str = Field("cpu", alias="LOCAL_WHISPER_DEVICE")

    image_provider: Literal["stability", "openai", "replicate", "local_sd"] = Field(
        "stability", alias="IMAGE_PROVIDER"
    )
    stability_api_key: str | None = Field(None, alias="STABILITY_API_KEY")
    replicate_api_token: str | None = Field(None, alias="REPLICATE_API_TOKEN")

    video_gen_provider: Literal["runway", "pika", "replicate", "disabled"] = Field(
        "disabled", alias="VIDEO_GEN_PROVIDER"
    )
    runway_api_key: str | None = Field(None, alias="RUNWAY_API_KEY")
    pika_api_key: str | None = Field(None, alias="PIKA_API_KEY")

    # URL import
    yt_dlp_binary: str = Field("yt-dlp", alias="YT_DLP_BINARY")
    yt_dlp_proxy: str | None = Field(None, alias="YT_DLP_PROXY")

    # Observability
    sentry_dsn: str | None = Field(None, alias="SENTRY_DSN")
    sentry_environment: str = Field("development", alias="SENTRY_ENVIRONMENT")

    @property
    def s3_kwargs(self) -> dict:
        kwargs: dict = {
            "region_name": self.s3_region,
            "aws_access_key_id": self.s3_access_key_id,
            "aws_secret_access_key": self.s3_secret_access_key,
        }
        if self.s3_endpoint:
            kwargs["endpoint_url"] = self.s3_endpoint
        return kwargs


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
