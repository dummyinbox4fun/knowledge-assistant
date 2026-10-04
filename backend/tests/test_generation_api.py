from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_answer_with_no_documents_returns_canned_message():
    # fresh isolated store per test (conftest fixture) — nothing uploaded yet
    resp = client.post("/generation/answer", json={"query": "anything"})

    assert resp.status_code == 200
    data = resp.json()
    assert "don't have" in data["answer"].lower() or "no" in data["answer"].lower()
    assert data["sources"] == []


def test_answer_returns_sources_from_uploaded_document(monkeypatch):
    # Mock the actual Gemini call so this test doesn't burn a real API request
    from app.api import generation as generation_module

    monkeypatch.setattr(
        generation_module, "generate_answer", lambda query, chunks: "Mocked answer."
    )

    client.post(
        "/ingestion/upload",
        files={"file": ("facts.md", b"# Facts\n\nThe sky is blue.", "text/markdown")},
    )

    resp = client.post("/generation/answer", json={"query": "Tell me a fact"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["answer"] == "Mocked answer."
    assert len(data["sources"]) > 0
    assert data["sources"][0]["filename"] == "facts.md"


def test_answer_empty_query_returns_400():
    resp = client.post("/generation/answer", json={"query": "   "})
    assert resp.status_code == 400


def test_answer_missing_query_field_returns_422():
    resp = client.post("/generation/answer", json={})
    assert resp.status_code == 422


def test_answer_wraps_generation_errors_as_502(monkeypatch):
    from app.api import generation as generation_module

    def raise_error(query, chunks):
        raise RuntimeError("Gemini API call failed: simulated failure")

    monkeypatch.setattr(generation_module, "generate_answer", raise_error)

    client.post(
        "/ingestion/upload",
        files={"file": ("facts2.md", b"# Facts\n\nThe sky is blue.", "text/markdown")},
    )

    resp = client.post("/generation/answer", json={"query": "Tell me a fact"})

    assert resp.status_code == 502
