import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from workspace root (single source of truth for shared keys)
_root_dir = Path(__file__).resolve().parent.parent.parent.parent  # Tarang/

load_dotenv(dotenv_path=_root_dir / ".env")


def _csv_env(name: str, default: str = "") -> list[str]:
    """Read a comma-separated env var into a clean list."""
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    """Typed settings loaded from environment variables."""

    APP_ENV: str = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()

    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    CLERK_WEBHOOK_SECRET: str = os.getenv("CLERK_WEBHOOK_SECRET") or os.getenv(
        "CLERK_WEBHOOK_SIGNING_SECRET", ""
    )
    CLERK_JWKS_URL: str = os.getenv(
        "CLERK_JWKS_URL",
        "https://clerk.trytarang.app/.well-known/jwks.json",
    )
    CLERK_JWT_ISSUER: str = os.getenv("CLERK_JWT_ISSUER", "")
    CLERK_JWT_AUDIENCE: str = os.getenv("CLERK_JWT_AUDIENCE", "")

    CORS_ALLOWED_ORIGINS: list[str] = _csv_env(
        "CORS_ALLOWED_ORIGINS",
        ",".join(
            [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
            ]
        ),
    )

    REDIS_URL: str = os.getenv("REDIS_URL", "")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
    RUNPOD_API_KEY: str = os.getenv("RUNPOD_API_KEY", "")

    # Storage (Cloudflare R2)
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")

    # Limits
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))

    # Replicate API Key (kept for future use)
    REPLICATE_API_TOKEN: str = os.getenv("REPLICATE_API_TOKEN", "")

    # Modal OmniVoice clone endpoint (from `modal deploy modal_app.py`)
    MODAL_CLONE_ENDPOINT: str = os.getenv("MODAL_CLONE_ENDPOINT", "")

    # Modal Demucs separation endpoint (from `modal deploy apps/ai_workers/demucs/modal_app.py`)
    MODAL_DEMUCS_ENDPOINT: str = os.getenv("MODAL_DEMUCS_ENDPOINT", "")

    # Modal Qwen3-TTS endpoint (from `modal deploy apps/ai_workers/qwen3_tts/modal_app.py`)
    MODAL_QWEN3_TTS_ENDPOINT: str = os.getenv("MODAL_QWEN3_TTS_ENDPOINT", "")

    # Modal OmniVoice cache voice prompt endpoint (pre-computes Whisper ASR)
    MODAL_CACHE_VOICE_ENDPOINT: str = os.getenv("MODAL_CACHE_VOICE_ENDPOINT", "")

    # Shared secret used by the API when calling public Modal web endpoints.
    MODAL_SHARED_SECRET: str = os.getenv("MODAL_SHARED_SECRET", "")

    # Shared secret between Vercel frontend and Cloud Run backend.
    # Protects the *.run.app URL from unauthorized direct access.
    # Set to empty string in development (disables the check).
    CLOUD_RUN_SHARED_SECRET: str = os.getenv("CLOUD_RUN_SHARED_SECRET", "")

    # Dubbing pipeline API keys
    GLADIA_API_KEY: str = os.getenv("GLADIA_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    MODAL_PROXY_TOKEN_ID: str = os.getenv("MODAL_PROXY_TOKEN_ID", "wk-WJdZexiA4Ftw2AP0OKNWlN")
    MODAL_PROXY_TOKEN_SECRET: str = os.getenv("MODAL_PROXY_TOKEN_SECRET", "ws-eaKx1ZFOwRO7et1xMjDbyZ")
    MODAL_QWEN_ENDPOINT: str = os.getenv("MODAL_QWEN_ENDPOINT", "https://jaychhaya3489--ep-qwen3-6-35b-a3b-server.us-west.modal.direct/v1/chat/completions")

    # Dubbing validation limits
    MAX_VIDEO_DURATION_SEC: int = int(os.getenv("MAX_VIDEO_DURATION_SEC", "300"))  # 5 min
    MAX_VIDEO_SIZE_MB: int = int(os.getenv("MAX_VIDEO_SIZE_MB", "100"))

    def validate_for_runtime(self) -> list[str]:
        """Return missing production-critical settings.

        Development keeps permissive defaults so local smoke tests can import
        the app. Staging/production should fail fast before accepting traffic.
        """
        required = [
            "DATABASE_URL",
            "CLERK_JWKS_URL",
            "CLERK_WEBHOOK_SECRET",
            "R2_ACCOUNT_ID",
            "R2_BUCKET_NAME",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "MODAL_CLONE_ENDPOINT",
            "MODAL_DEMUCS_ENDPOINT",
        ]
        return [name for name in required if not getattr(self, name)]

    @property
    def is_strict_env(self) -> bool:
        return self.APP_ENV in {"production", "prod", "staging"}


settings = Settings()
