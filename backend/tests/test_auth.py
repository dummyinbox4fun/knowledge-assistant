"""Login protection on the real app.

conftest.py normally replaces the login check with a fake signed-in user so
the other API tests don't need real tokens. Here we switch that off to prove
the real check is wired onto the routes.
"""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import auth
from app.auth import require_auth
from app.config import settings
from app.main import app

SUPABASE_URL = "https://example-project.supabase.co"
KEY = ec.generate_private_key(ec.SECP256R1())


class _FakeKey:
    key = KEY.public_key()


class _FakeJwks:
    def get_signing_key_from_jwt(self, token):
        return _FakeKey()


@pytest.fixture(autouse=True)
def real_login(monkeypatch):
    app.dependency_overrides.pop(require_auth, None)
    monkeypatch.setattr(settings, "supabase_url", SUPABASE_URL)
    monkeypatch.setattr(auth, "_get_jwks_client", lambda url: _FakeJwks())


client = TestClient(app)


def _token():
    return jwt.encode(
        {
            "sub": "00000000-0000-0000-0000-0000000000cc",
            "aud": "authenticated",
            "iss": f"{SUPABASE_URL}/auth/v1",
            "exp": int(time.time()) + 3600,
        },
        KEY,
        algorithm="ES256",
    )


def test_health_accessible_without_login():
    resp = client.get("/health")
    assert resp.status_code == 200


def test_protected_endpoint_rejects_missing_login():
    resp = client.post("/retrieval/search", json={"query": "test"})
    assert resp.status_code == 401


def test_old_api_key_no_longer_works():
    resp = client.post(
        "/retrieval/search",
        json={"query": "test"},
        headers={"X-API-Key": "secret123"},
    )
    assert resp.status_code == 401


def test_protected_endpoint_rejects_garbage_token():
    resp = client.post(
        "/retrieval/search",
        json={"query": "test"},
        headers={"Authorization": "Bearer not-a-jwt"},
    )
    assert resp.status_code == 401


def test_protected_endpoint_accepts_valid_login_token():
    resp = client.post(
        "/retrieval/search",
        json={"query": "test"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert resp.status_code != 401
