"""Smoke test — verifies the API starts and /health responds.

This is the most basic test: if this fails, something fundamental
is broken in the app wiring (imports, middleware, router registration).
"""

import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    """GET /health should return 200 with a JSON body."""
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_response_body(client):
    """GET /health response should contain a status field."""
    response = await client.get("/health")
    data = response.json()
    assert "status" in data
