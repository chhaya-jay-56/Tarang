"""Clerk JWT verification utilities.

Uses PyJWT with the `cryptography` backend to validate RS256-signed
JWTs against Clerk's published JWKS endpoint. The `PyJWKClient`
handles fetching and caching the public keys automatically.
"""

import jwt
from jwt import PyJWKClient

from app.config import settings

# The client fetches/caches Clerk's public signing keys.
_jwks_client = PyJWKClient(settings.CLERK_JWKS_URL)


def verify_clerk_token(token: str) -> dict:
    """Decode and validate a Clerk-issued JWT.

    Args:
        token: The raw Bearer token string.

    Returns:
        The decoded JWT payload dict (contains ``sub``, ``iat``, etc.).

    Raises:
        jwt.exceptions.PyJWTError: On any signature/expiration/format
            failure — callers should catch this to return a 401.
    """
    signing_key = _jwks_client.get_signing_key_from_jwt(token)
    decode_kwargs = {}
    if settings.CLERK_JWT_ISSUER:
        decode_kwargs["issuer"] = settings.CLERK_JWT_ISSUER
    if settings.CLERK_JWT_AUDIENCE:
        decode_kwargs["audience"] = settings.CLERK_JWT_AUDIENCE

    payload: dict = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        options={
            "require": ["exp", "sub"],
            "verify_aud": bool(settings.CLERK_JWT_AUDIENCE),
        },
        **decode_kwargs,
    )
    return payload
