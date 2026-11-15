"""Login-token (JWT) authentication.

Uses a small standalone app rather than the real one, and signs its own
tokens with a throwaway key, so no Supabase account or network is needed.
"""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import auth
from app.auth import AuthUser, require_auth
from app.config import settings

SUPABASE_URL = "https://example-project.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"

# Throwaway key pairs for the whole test module
SIGNING_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())


class FakeSigningKey:
    def __init__(self, key):
        self.key = key


class FakeJwksClient:
    """Stands in for PyJWKClient: always returns our test public key."""

    def get_signing_key_from_jwt(self, token):
        return FakeSigningKey(SIGNING_KEY.public_key())


def make_token(private_key=SIGNING_KEY, **overrides):
    claims = {
        "sub": "user-123",
        "email": "me@example.com",
        "aud": "authenticated",
        "iss": ISSUER,
        "exp": int(time.time()) + 3600,
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, private_key, algorithm="ES256")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", SUPABASE_URL)
    monkeypatch.setattr(auth, "_get_jwks_client", lambda url: FakeJwksClient())

    app = FastAPI()

    @app.get("/whoami")
    def whoami(user: AuthUser = Depends(require_auth)):
        return {"id": user.id, "email": user.email}

    return TestClient(app)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_valid_token_returns_the_user(client):
    resp = client.get("/whoami", headers=bearer(make_token()))
    assert resp.status_code == 200
    assert resp.json() == {"id": "user-123", "email": "me@example.com"}


def test_expired_token_is_rejected(client):
    resp = client.get("/whoami", headers=bearer(make_token(exp=int(time.time()) - 10)))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid or expired token"


def test_wrong_audience_is_rejected(client):
    resp = client.get("/whoami", headers=bearer(make_token(aud="something-else")))
    assert resp.status_code == 401


def test_wrong_issuer_is_rejected(client):
    resp = client.get(
        "/whoami", headers=bearer(make_token(iss="https://evil.example.com/auth/v1"))
    )
    assert resp.status_code == 401


def test_token_signed_with_another_key_is_rejected(client):
    resp = client.get("/whoami", headers=bearer(make_token(private_key=OTHER_KEY)))
    assert resp.status_code == 401


def test_token_without_subject_is_rejected(client):
    resp = client.get("/whoami", headers=bearer(make_token(sub=None)))
    assert resp.status_code == 401


def test_garbage_token_is_rejected(client):
    resp = client.get("/whoami", headers=bearer("not-a-jwt"))
    assert resp.status_code == 401


def test_hs256_token_is_rejected(client):
    forged = jwt.encode(
        {
            "sub": "attacker",
            "aud": "authenticated",
            "iss": ISSUER,
            "exp": int(time.time()) + 3600,
        },
        "a-shared-secret-that-is-long-enough-for-hs256",
        algorithm="HS256",
    )
    resp = client.get("/whoami", headers=bearer(forged))
    assert resp.status_code == 401


def test_non_bearer_scheme_is_rejected(client):
    resp = client.get("/whoami", headers={"Authorization": "Basic abc123"})
    assert resp.status_code == 401


def test_token_rejected_when_login_is_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "")
    resp = client.get("/whoami", headers=bearer(make_token()))
    assert resp.status_code == 401
    assert "not configured" in resp.json()["detail"]


def test_keys_unreachable_returns_503(client, monkeypatch):
    class BrokenJwksClient:
        def get_signing_key_from_jwt(self, token):
            raise jwt.PyJWKClientConnectionError("network down")

    monkeypatch.setattr(auth, "_get_jwks_client", lambda url: BrokenJwksClient())
    resp = client.get("/whoami", headers=bearer(make_token()))
    assert resp.status_code == 503


def test_unknown_signing_key_returns_401(client, monkeypatch):
    class NoKeyJwksClient:
        def get_signing_key_from_jwt(self, token):
            raise jwt.PyJWKClientError("Unable to find a signing key")

    monkeypatch.setattr(auth, "_get_jwks_client", lambda url: NoKeyJwksClient())
    resp = client.get("/whoami", headers=bearer(make_token()))
    assert resp.status_code == 401


# --- no credentials / the old shared key no longer gets anyone in ---


def test_no_credentials_is_rejected(client):
    resp = client.get("/whoami")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Sign in required"


def test_old_api_key_header_no_longer_works(client):
    resp = client.get("/whoami", headers={"X-API-Key": "secret-key"})
    assert resp.status_code == 401
