import importlib

import pytest


def test_settings_accepts_clerk_webhook_signing_secret(monkeypatch):
    monkeypatch.delenv("CLERK_WEBHOOK_SECRET", raising=False)
    monkeypatch.setenv("CLERK_WEBHOOK_SIGNING_SECRET", "whsec_from_clerk_docs")

    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)

    import app.config as config

    reloaded = importlib.reload(config)

    assert reloaded.settings.CLERK_WEBHOOK_SECRET == "whsec_from_clerk_docs"


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/webhooks", "/api/webhooks/", "/api/webhooks/clerk"])
async def test_clerk_webhook_paths_are_registered(client, monkeypatch, path):
    from app.routers import webhooks

    monkeypatch.setattr(webhooks.settings, "CLERK_WEBHOOK_SECRET", "whsec_test")

    response = await client.post(path, content=b"{}")

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing Svix headers"
