"""Each user sees and changes only their own documents (#93).

conftest.py signs every request in as one fake user. Here we switch between
two users with app.dependency_overrides, upload as one, and check the other
cannot see, read, search or delete anything.
"""

from fastapi.testclient import TestClient

from app import db
from app.auth import AuthUser, require_auth
from app.embedding.embedder import embed_text
from app.main import app

USER_A = "00000000-0000-0000-0000-0000000000aa"
USER_B = "00000000-0000-0000-0000-0000000000bb"

client = TestClient(app)


def as_user(user_id: str) -> None:
    app.dependency_overrides[require_auth] = lambda: AuthUser(id=user_id, email=None)


def upload(name: str, content: bytes = b"# Cats\n\nCats are small animals."):
    return client.post(
        "/ingestion/upload", files={"file": (name, content, "text/markdown")}
    )


def names(response) -> list[str]:
    return [d["filename"] for d in response.json()["documents"]]


def insert_old_style_document(filename: str, user_id: str | None, content: str):
    """A document as it exists after the V3.3 migration + backfill: plain
    filename as the key, owner and display name filled in. With user_id=None
    it is an unclaimed row (e.g. created by an older app version)."""
    with db.get_cursor() as cur:
        cur.execute(
            "INSERT INTO documents "
            "(filename, user_id, display_name, length_chars, chunk_count) "
            "VALUES (%s, %s, %s, %s, 1)",
            (filename, user_id, filename if user_id else None, len(content)),
        )
        cur.execute(
            "INSERT INTO chunks (filename, position, content, embedding) "
            "VALUES (%s, 0, %s, %s)",
            (filename, content, embed_text(content)),
        )


def test_other_user_sees_an_empty_library():
    as_user(USER_A)
    upload("private.md")

    as_user(USER_B)
    resp = client.get("/ingestion/documents")
    assert resp.status_code == 200
    assert resp.json()["documents"] == []


def test_owner_still_sees_their_document():
    as_user(USER_A)
    upload("private.md")
    assert names(client.get("/ingestion/documents")) == ["private.md"]


def test_other_user_cannot_read_chunks():
    as_user(USER_A)
    upload("private.md")

    as_user(USER_B)
    assert client.get("/ingestion/documents/private.md/chunks").status_code == 404


def test_other_user_cannot_read_embeddings():
    as_user(USER_A)
    upload("private.md")

    as_user(USER_B)
    assert client.get("/embedding/documents/private.md/embeddings").status_code == 404


def test_other_user_cannot_delete_and_the_document_survives():
    as_user(USER_A)
    upload("private.md")

    as_user(USER_B)
    assert client.delete("/ingestion/documents/private.md").status_code == 404

    as_user(USER_A)
    assert names(client.get("/ingestion/documents")) == ["private.md"]


def test_search_only_returns_the_users_own_chunks():
    as_user(USER_A)
    upload("private.md")

    as_user(USER_B)
    resp = client.post("/retrieval/search", json={"query": "cats"})
    assert resp.status_code == 200
    assert resp.json()["results"] == []

    as_user(USER_A)
    resp = client.post("/retrieval/search", json={"query": "cats"})
    assert [r["filename"] for r in resp.json()["results"]] == ["private.md"]


def test_answer_does_not_use_other_users_documents():
    as_user(USER_A)
    upload("private.md")

    as_user(USER_B)
    resp = client.post("/generation/answer", json={"query": "cats"})
    assert resp.status_code == 200
    assert resp.json()["sources"] == []


def test_two_users_can_each_have_a_file_with_the_same_name():
    as_user(USER_A)
    assert upload("notes.md", b"# A's notes").status_code == 200

    as_user(USER_B)
    assert upload("notes.md", b"# B's notes").status_code == 200

    chunks = client.get("/ingestion/documents/notes.md/chunks").json()["chunks"]
    assert "B's notes" in chunks[0]["content"]

    as_user(USER_A)
    chunks = client.get("/ingestion/documents/notes.md/chunks").json()["chunks"]
    assert "A's notes" in chunks[0]["content"]


def test_duplicate_name_is_only_rejected_within_the_same_user():
    as_user(USER_A)
    assert upload("notes.md").status_code == 200
    assert upload("notes.md").status_code == 409

    as_user(USER_B)
    assert upload("notes.md").status_code == 200


def test_deleting_your_copy_leaves_the_other_users_copy():
    as_user(USER_A)
    upload("notes.md", b"# A's notes")
    as_user(USER_B)
    upload("notes.md", b"# B's notes")

    as_user(USER_A)
    assert client.delete("/ingestion/documents/notes.md").status_code == 200
    assert names(client.get("/ingestion/documents")) == []

    as_user(USER_B)
    assert names(client.get("/ingestion/documents")) == ["notes.md"]
    chunks = client.get("/ingestion/documents/notes.md/chunks").json()["chunks"]
    assert "B's notes" in chunks[0]["content"]


def test_search_results_show_the_display_name_not_the_internal_key():
    as_user(USER_A)
    upload("private.md")

    results = client.post("/retrieval/search", json={"query": "cats"}).json()["results"]
    assert results[0]["filename"] == "private.md"
    assert USER_A not in results[0]["filename"]


def test_documents_from_before_v33_belong_to_their_backfilled_owner():
    insert_old_style_document("legacy.md", USER_A, "legacy cat facts")

    as_user(USER_A)
    assert names(client.get("/ingestion/documents")) == ["legacy.md"]
    chunks = client.get("/ingestion/documents/legacy.md/chunks").json()["chunks"]
    assert chunks[0]["content"] == "legacy cat facts"
    results = client.post("/retrieval/search", json={"query": "cats"}).json()["results"]
    assert results[0]["filename"] == "legacy.md"

    as_user(USER_B)
    assert names(client.get("/ingestion/documents")) == []
    assert client.get("/ingestion/documents/legacy.md/chunks").status_code == 404

    as_user(USER_A)
    assert client.delete("/ingestion/documents/legacy.md").status_code == 200
    assert names(client.get("/ingestion/documents")) == []


def test_unclaimed_documents_are_invisible_to_everyone():
    insert_old_style_document("orphan.md", None, "nobody owns this")

    for user in (USER_A, USER_B):
        as_user(user)
        assert names(client.get("/ingestion/documents")) == []
        assert client.get("/ingestion/documents/orphan.md/chunks").status_code == 404
        assert client.delete("/ingestion/documents/orphan.md").status_code == 404
        results = client.post("/retrieval/search", json={"query": "owns"}).json()["results"]
        assert results == []
