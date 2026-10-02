from fastapi.testclient import TestClient

from app.ingestion.store import clear_documents
from app.main import app

client = TestClient(app)


def setup_function():
    clear_documents()


def test_get_embeddings_for_uploaded_document():
    client.post(
        "/ingestion/upload",
        files={"file": ("notes.md", b"# Hello world, this is a test note.", "text/markdown")},
    )
    resp = client.get("/embedding/documents/notes.md/embeddings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "notes.md"
    assert data["chunk_count"] == 1
    assert len(data["embeddings"]) == 1
    assert data["embeddings"][0]["dimension"] > 0
    assert len(data["embeddings"][0]["sample_values"]) <= 5


def test_get_embeddings_for_missing_document_returns_404():
    resp = client.get("/embedding/documents/does-not-exist.md/embeddings")
    assert resp.status_code == 404


def test_embeddings_endpoint_does_not_return_full_vector():
    client.post(
        "/ingestion/upload",
        files={"file": ("notes.md", b"# Hello world", "text/markdown")},
    )
    resp = client.get("/embedding/documents/notes.md/embeddings")
    data = resp.json()
    # sample_values should be a short preview, not the full ~768-dim vector
    assert len(data["embeddings"][0]["sample_values"]) < data["embeddings"][0]["dimension"]
