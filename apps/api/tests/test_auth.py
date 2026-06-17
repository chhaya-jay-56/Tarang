import pytest
from fastapi import HTTPException
from jwt.exceptions import PyJWTError
from starlette.requests import Request

from app.dependencies import get_current_user


def _request_with_auth(value: str | None = None) -> Request:
    headers = []
    if value is not None:
        headers.append((b"authorization", value.encode("utf-8")))
    return Request({"type": "http", "headers": headers})


@pytest.mark.asyncio
async def test_get_current_user_requires_bearer_token():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(_request_with_auth())

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_returns_clerk_subject(monkeypatch):
    monkeypatch.setattr(
        "app.dependencies.verify_clerk_token",
        lambda token: {"sub": "user_123"},
    )

    user_id = await get_current_user(_request_with_auth("Bearer token"))

    assert user_id == "user_123"


@pytest.mark.asyncio
async def test_get_current_user_rejects_invalid_jwt(monkeypatch):
    def _raise(_token: str):
        raise PyJWTError("bad token")

    monkeypatch.setattr("app.dependencies.verify_clerk_token", _raise)

    with pytest.raises(HTTPException) as exc:
        await get_current_user(_request_with_auth("Bearer token"))

    assert exc.value.status_code == 401
