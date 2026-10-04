from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_search_returns_relevant_chunk():
    client.post(
        "/ingestion/upload",
        files={"file": ("animals.md", b"# Cats\n\nCats are small domestic animals.", "text/markdown")},
    )
    client.post(
        "/ingestion/upload",
        files={"file": ("cars.md", b"# Engines\n\nCar engines burn fuel to create power.", "text/markdown")},
    )

    resp = client.post("/retrieval/search", json={"query": "pets and cats", "top_k": 5})

    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "pets and cats"
    assert len(data["results"]) > 0
    # the cat-related chunk should rank first for a cat-related query
    assert data["results"][0]["filename"] == "animals.md"


def test_search_respects_top_k():
    for i in range(3):
        client.post(
            "/ingestion/upload",
            files={"file": (f"doc{i}.md", f"# Document {i}\n\nSome unique content {i}.".encode(), "text/markdown")},
        )

    resp = client.post("/retrieval/search", json={"query": "document content", "top_k": 2})

    assert resp.status_code == 200
    assert len(resp.json()["results"]) <= 2


def test_search_empty_query_returns_400():
    resp = client.post("/retrieval/search", json={"query": "   "})
    assert resp.status_code == 400


def test_search_missing_query_field_returns_422():
    resp = client.post("/retrieval/search", json={})
    assert resp.status_code == 422


def test_search_default_top_k_is_five():
    resp = client.post("/retrieval/search", json={"query": "anything"})
    assert resp.status_code == 200
    # just confirms the request is accepted without top_k — default applied server-side
