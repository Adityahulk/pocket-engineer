from __future__ import annotations

import asyncio
from dataclasses import dataclass

import jwt
from fastapi import HTTPException

from .config import Settings


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None


class SupabaseTokenVerifier:
    """Verifies Supabase access tokens against the project's asymmetric JWKS."""

    def __init__(self) -> None:
        self._url = ""
        self._client: jwt.PyJWKClient | None = None

    def _client_for(self, supabase_url: str) -> jwt.PyJWKClient:
        normalized = supabase_url.rstrip("/")
        if not self._client or self._url != normalized:
            self._url = normalized
            self._client = jwt.PyJWKClient(
                f"{normalized}/auth/v1/.well-known/jwks.json",
                cache_jwk_set=True,
                lifespan=600,
            )
        return self._client

    def verify_sync(self, token: str, settings: Settings) -> AuthenticatedUser:
        if not settings.supabase_url:
            raise HTTPException(503, "Supabase authentication is enabled but POCKET_SUPABASE_URL is missing")
        try:
            key = self._client_for(settings.supabase_url).get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key.key,
                algorithms=["RS256", "ES256"],
                audience="authenticated",
                issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(401, "Invalid or expired access token") from exc
        email = claims.get("email")
        allowed = settings.allowed_auth_emails
        if allowed and (not email or email.lower() not in allowed):
            raise HTTPException(403, "This account is not allowed to access this private alpha")
        return AuthenticatedUser(id=claims["sub"], email=email)

    async def verify(self, token: str, settings: Settings) -> AuthenticatedUser:
        return await asyncio.to_thread(self.verify_sync, token, settings)


verifier = SupabaseTokenVerifier()


async def authenticate_header(authorization: str | None, settings: Settings) -> AuthenticatedUser:
    if settings.auth_mode == "disabled":
        return AuthenticatedUser(id="local-development", email=None)
    if settings.auth_mode != "supabase":
        raise HTTPException(503, f"Unsupported authentication mode: {settings.auth_mode}")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "A bearer access token is required")
    return await verifier.verify(token, settings)
