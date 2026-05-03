import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from workspace root (single source of truth for shared keys)
_root_dir = Path(__file__).resolve().parent.parent.parent.parent  # Tarang/

load_dotenv(dotenv_path=_root_dir / ".env")


class Settings:
    """Typed settings loaded from environment variables."""

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://jay:jay123@localhost:5433/tarangdb"
    )
    CLERK_WEBHOOK_SECRET: str = os.getenv("CLERK_WEBHOOK_SECRET") or os.getenv(
        "CLERK_WEBHOOK_SIGNING_SECRET", ""
    )
    CLERK_JWKS_URL: str = os.getenv(
        "CLERK_JWKS_URL",
        "https://distinct-ram-14.clerk.accounts.dev/.well-known/jwks.json",
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

settings = Settings()
