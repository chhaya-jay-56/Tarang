import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.dependencies import get_current_user
from app.main import app
from app.routers import voice_library


@pytest.mark.asyncio
async def test_voice_library_lists_presets_and_custom_voices(client, monkeypatch):
    user_id = uuid.uuid4()
    voice_id = uuid.uuid4()

    app.dependency_overrides[get_current_user] = lambda: "clerk_user"
    monkeypatch.setattr(
        voice_library.clone_service,
        "resolve_user_id",
        _async_value(user_id),
    )
    monkeypatch.setattr(
        voice_library.voice_library_service,
        "list_user_voices",
        _async_value(
            [
                {
                    "id": str(voice_id),
                    "name": "Preset",
                    "description": None,
                    "voice_type": "preset",
                    "language": "en",
                    "duration_ms": 1000,
                    "is_preset": True,
                    "r2_key": "voices/preset.wav",
                    "created_at": datetime.now(timezone.utc),
                }
            ]
        ),
    )
    monkeypatch.setattr(
        voice_library,
        "get_download_presigned_url",
        lambda key: f"https://r2.local/{key}",
    )

    try:
        response = await client.get("/api/voice-library")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["voices"][0]["audio_url"].endswith("voices/preset.wav")


@pytest.mark.asyncio
async def test_voice_library_create_returns_created_voice(client, monkeypatch):
    user_id = uuid.uuid4()
    voice_id = uuid.uuid4()
    created = SimpleNamespace(
        id=voice_id,
        name="My Voice",
        description="Warm",
        language="en",
        duration_ms=1500,
        r2_key="voices/custom.wav",
        created_at=datetime.now(timezone.utc),
    )

    app.dependency_overrides[get_current_user] = lambda: "clerk_user"
    monkeypatch.setattr(
        voice_library.clone_service,
        "resolve_user_id",
        _async_value(user_id),
    )
    monkeypatch.setattr(
        voice_library.voice_library_service,
        "create_voice",
        _async_value(created),
    )
    monkeypatch.setattr(
        voice_library,
        "get_download_presigned_url",
        lambda key: f"https://r2.local/{key}",
    )

    try:
        response = await client.post(
            "/api/voice-library",
            data={"name": "My Voice", "description": "Warm", "language": "en"},
            files={"file": ("voice.wav", b"RIFF....WAVE", "audio/wav")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == str(voice_id)
    assert data["audio_url"].endswith("voices/custom.wav")


@pytest.mark.asyncio
async def test_voice_library_delete_returns_204(client, monkeypatch):
    user_id = uuid.uuid4()
    voice_id = uuid.uuid4()
    deleted = []

    app.dependency_overrides[get_current_user] = lambda: "clerk_user"
    monkeypatch.setattr(
        voice_library.clone_service,
        "resolve_user_id",
        _async_value(user_id),
    )

    async def fake_delete(_db, deleted_voice_id, deleted_user_id):
        deleted.append((deleted_voice_id, deleted_user_id))

    monkeypatch.setattr(
        voice_library.voice_library_service,
        "delete_saved_voice",
        fake_delete,
    )

    try:
        response = await client.delete(f"/api/voice-library/{voice_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204
    assert deleted == [(voice_id, user_id)]


def _async_value(value):
    async def _inner(*_args, **_kwargs):
        return value

    return _inner
