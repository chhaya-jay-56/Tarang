from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    """Simple health check for Railway/monitoring."""
    return {"status": "ok", "service": "tarang-backend"}
