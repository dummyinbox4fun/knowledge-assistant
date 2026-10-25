"""Authentication.

Every protected route requires a Supabase login token:
``Authorization: Bearer <JWT>``. Supabase signs these with a private key it
never shares; we verify them with its public keys (JWKS), so no secret is
stored here. Checks: signature, expiry, audience ("authenticated") and issuer
(this Supabase project).
"""

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient

from app.config import settings

# Supabase signs with an asymmetric key (ECC P-256 = ES256). HS256 is
# deliberately not allowed, so a token can never be "verified" using a
# public key as if it were a shared secret.
_ALGORITHMS = ["ES256", "RS256"]
_AUDIENCE = "authenticated"

_BEARER = {"WWW-Authenticate": "Bearer"}


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None = None


@lru_cache(maxsize=1)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    # PyJWKClient caches the fetched keys, so Supabase is not called per request.
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=3600, timeout=5)


def _verify_token(token: str) -> AuthUser:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=401,
            detail="Login is not configured on this server",
            headers=_BEARER,
        )

    base = settings.supabase_url.rstrip("/")
    try:
        signing_key = _get_jwks_client(
            f"{base}/auth/v1/.well-known/jwks.json"
        ).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience=_AUDIENCE,
            issuer=f"{base}/auth/v1",
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWKClientConnectionError:
        # We could not fetch Supabase's keys: not the caller's fault.
        raise HTTPException(
            status_code=503,
            detail="Could not verify your login right now. Please try again.",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401, detail="Invalid or expired token", headers=_BEARER
        )

    return AuthUser(id=claims["sub"], email=claims.get("email"))


def require_auth(authorization: str | None = Header(default=None)) -> AuthUser:
    """Return the signed-in user, or reject the request with 401."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Sign in required", headers=_BEARER)

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=401, detail="Invalid or expired token", headers=_BEARER
        )
    return _verify_token(token.strip())
