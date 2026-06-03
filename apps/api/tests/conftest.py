"""Shared test fixtures for Tarang API tests.

Uses httpx.AsyncClient with FastAPI's TestClient pattern for async
endpoint testing. No real database or external services needed for
smoke tests — those use mocks or the test DB.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def anyio_backend():
    """Force pytest-asyncio to use asyncio backend."""
    return "asyncio"


@pytest.fixture
async def client():
    """Async HTTP test client bound to the FastAPI app.

    Usage in tests:
        async def test_something(client):
            resp = await client.get("/health")
            assert resp.status_code == 200
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
