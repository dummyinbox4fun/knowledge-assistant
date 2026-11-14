"""The 429 response uses the same {"detail": ...} shape as every other error."""

from fastapi.testclient import TestClient
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.main import app


def test_rate_limited_response_uses_the_detail_format(monkeypatch):
    # Swap in a tiny limit for this test only (restored automatically).
    monkeypatch.setattr(
        app.state,
        "limiter",
        Limiter(key_func=get_remote_address, default_limits=["2/minute"]),
    )
    client = TestClient(app)

    assert client.get("/health").status_code == 200
    assert client.get("/health").status_code == 200
    resp = client.get("/health")

    assert resp.status_code == 429
    body = resp.json()
    assert body["detail"].startswith("Rate limit exceeded")
    assert "error" not in body
    # request tracing still applies to rate-limited responses
    assert "x-request-id" in resp.headers
