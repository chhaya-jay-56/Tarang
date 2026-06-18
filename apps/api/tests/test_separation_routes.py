import uuid

import pytest

from app.dependencies import get_current_user, get_db
from app.main import app
from app.routers import separation


@pytest.mark.asyncio
async def test_separation_direct_requires_auth(client):
    response = await client.post(
        "/api/v1/separation/separate-direct",
        files={"file": ("sample.wav", b"RIFF....WAVE", "audio/wav")},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_separation_direct_charges_and_returns_urls(client, monkeypatch):
    user_id = uuid.uuid4()

    app.dependency_overrides[get_current_user] = lambda: "clerk_user"
    app.dependency_overrides[get_db] = lambda: FakeDb()
    monkeypatch.setattr(
        separation.clone_service,
        "resolve_user_id",
        _async_value(user_id),
    )
    monkeypatch.setattr(separation, "_charge_separation", _async_value((9, 12.0)))
    monkeypatch.setattr(separation, "upload_file", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        separation,
        "separate_audio",
        _async_value(
            {
                "vocal_r2_key": "dub/job/vocals.wav",
                "instrumental_r2_key": "dub/job/instrumental.wav",
                "vocals_size_bytes": 10,
                "instrumental_size_bytes": 20,
                "sample_rate": 44100,
            }
        ),
    )
    monkeypatch.setattr(
        separation,
        "get_download_presigned_url",
        lambda key, expiration=3600: f"https://r2.local/{key}",
    )

    try:
        response = await client.post(
            "/api/v1/separation/separate-direct",
            files={"file": ("sample.wav", b"RIFF....WAVE", "audio/wav")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["credits_used"] == 9
    assert data["vocals_url"].endswith("vocals.wav")
    assert data["instrumental_url"].endswith("instrumental.wav")


def _async_value(value):
    async def _inner(*_args, **_kwargs):
        return value

    return _inner


class FakeDb:
    def __init__(self):
        self.added = []
        self.commits = 0

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        pass
