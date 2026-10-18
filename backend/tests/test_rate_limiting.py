"""Verifies the slowapi rate-limiting wiring itself, using a small
standalone app rather than the real one.

The real app (app.main.app) is a single shared instance across the whole
test suite — every test file's TestClient hits the same Limiter and the
same in-memory request counter. Deliberately exceeding a limit there would
poison state for every test that runs afterward. So this file builds its
own tiny FastAPI + slowapi app, just to confirm the integration pattern
(429 on exceeding, 200 while under) behaves as expected — the real app
wires things up identically, just with a much higher limit (see
app.config.settings.rate_limit) that the full suite's ~85 requests never
comes close to tripping.
"""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address


def make_limited_app(limit: str) -> FastAPI:
    app = FastAPI()
    limiter = Limiter(key_func=get_remote_address, default_limits=[limit])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.get("/ping")
    def ping():
        return {"pong": True}

    return app


def test_requests_within_limit_succeed():
    client = TestClient(make_limited_app("3/minute"))
    for _ in range(3):
        resp = client.get("/ping")
        assert resp.status_code == 200


def test_requests_over_limit_return_429():
    client = TestClient(make_limited_app("3/minute"))
    for _ in range(3):
        client.get("/ping")

    resp = client.get("/ping")
    assert resp.status_code == 429