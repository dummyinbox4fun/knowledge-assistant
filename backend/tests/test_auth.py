from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_health_accessible_without_key():
    resp = client.get("/health")
    assert resp.status_code == 200


def test_protected_endpoint_open_when_no_access_token_configured(monkeypatch):
    monkeypatch.setattr(settings, "access_token", "")
    resp = client.post("/retrieval/search", json={"query": "test"})
    assert resp.status_code != 401


def test_protected_endpoint_rejects_missing_key_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "access_token", "secret123")
    resp = client.post("/retrieval/search", json={"query": "test"})
    assert resp.status_code == 401


def test_protected_endpoint_rejects_wrong_key(monkeypatch):
    monkeypatch.setattr(settings, "access_token", "secret123")
    resp = client.post(
        "/retrieval/search",
        json={"query": "test"},
        headers={"X-API-Key": "wrong-key"},
    )
    assert resp.status_code == 401


def test_protected_endpoint_accepts_correct_key(monkeypatch):
    monkeypatch.setattr(settings, "access_token", "secret123")
    resp = client.post(
        "/retrieval/search",
        json={"query": "test"},
        headers={"X-API-Key": "secret123"},
    )
    assert resp.status_code != 401