"""Startup validation runs through the app's lifespan handler."""

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def test_startup_fails_fast_when_required_settings_are_missing(monkeypatch):
    monkeypatch.setattr(settings, "environment", "dev")
    monkeypatch.setattr(settings, "gemini_api_key", "")

    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        with TestClient(app):
            pass


def test_startup_fails_fast_when_supabase_url_is_missing(monkeypatch):
    monkeypatch.setattr(settings, "environment", "dev")
    monkeypatch.setattr(settings, "gemini_api_key", "fake-key-value")
    monkeypatch.setattr(settings, "supabase_url", "")

    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        with TestClient(app):
            pass


def test_startup_succeeds_when_everything_is_configured(monkeypatch):
    monkeypatch.setattr(settings, "environment", "dev")
    monkeypatch.setattr(settings, "gemini_api_key", "fake-key-value")
    monkeypatch.setattr(settings, "supabase_url", "https://x.supabase.co")

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
