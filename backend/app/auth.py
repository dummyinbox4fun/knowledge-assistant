"""Shared-secret API key check.

Single-user project, so this is a lock on the door, not a user system:
one shared key, checked against the X-API-Key header.

If ACCESS_TOKEN is unset/empty, auth is disabled entirely — this is an
explicit, documented choice so local dev stays frictionless without
forcing a token. Production environments opt in by setting ACCESS_TOKEN.
"""
from fastapi import Header, HTTPException

from app.config import settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not settings.access_token:
        return  # auth disabled — no token configured for this environment

    if x_api_key != settings.access_token:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")