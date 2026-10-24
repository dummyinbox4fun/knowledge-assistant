"""Authentication.

There are two ways in while V3.2 is being rolled out:

1. A Supabase login token: ``Authorization: Bearer <JWT>``. Supabase signs
   these with a private key it never shares; we verify them with its public
   keys (JWKS), so no secret is stored here. Checks: signature, expiry,
   audience ("authenticated") and issuer (this Supabase project).
2. The legacy shared key: ``X-API-Key``, checked against ACCESS_TOKEN. If
   ACCESS_TOKEN is unset, this path is open so local dev stays frictionless.
   This path is removed in the last V3.2 PR.

If an Authorization header is sent it is always verified: a bad token is
rejected even when the legacy key is unset, never silently ignored.
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


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None = None


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not settings.access_token:
        return  # auth disabled — no token configured for this environment

    if x_api_key != settings.access_token:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@lru_cache(maxsize=1)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    # PyJWKClient caches the fetched keys, so Supabase is not called per request.
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=3600, timeout=5)


def _verify_token(token: str) -> AuthUser:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=401, detail="Login is not configured on this server"
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
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return AuthUser(id=claims["sub"], email=claims.get("email"))


def require_auth(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> AuthUser | None:
    """Accept a Supabase login token, or (for now) the legacy API key.

    Returns the signed-in user for a login token, or None for the legacy key
    or when auth is disabled.
    """
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return _verify_token(token.strip())

    require_api_key(x_api_key)
    return None