"""Create, list, read, rename, delete and ask in chats (#112)."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app import db
from app.auth import require_auth
from app.main import app

client = TestClient(app)


def new_chat(**body) -> dict:
    resp = client.post("/conversations", json=body)
    assert resp.status_code == 201
    return resp.json()


def upload(name: str = "cats.md", content: bytes = b"# Cats\n\nCats are small animals."):
    return client.post(
        "/ingestion/upload", files={"file": (name, content, "text/markdown")}
    )


@pytest.fixture
def fake_answer(monkeypatch):
    """Replace the Gemini call so these tests never reach the network."""
    monkeypatch.setattr(
        "app.api.conversations.generate_answer", lambda query, chunks: "a fake answer"
    )


def test_create_chat_gets_a_default_title():
    chat = new_chat()
    assert chat["title"] == "New chat"
    assert uuid.UUID(chat["id"])


def test_create_chat_with_a_title_trims_it():
    assert new_chat(title="  Trip plans  ")["title"] == "Trip plans"


def test_create_chat_without_any_body_works():
    resp = client.post("/conversations")
    assert resp.status_code == 201
    assert resp.json()["title"] == "New chat"


def test_create_chat_rejects_a_blank_or_too_long_title():
    assert client.post("/conversations", json={"title": "   "}).status_code == 400
    assert client.post("/conversations", json={"title": "x" * 121}).status_code == 422


def test_list_is_empty_for_a_new_user():
    resp = client.get("/conversations")
    assert resp.status_code == 200
    assert resp.json() == {"conversations": []}


def test_list_shows_the_most_recently_active_chat_first():
    first = new_chat(title="first")
    second = new_chat(title="second")

    def titles():
        return [c["title"] for c in client.get("/conversations").json()["conversations"]]

    assert titles() == ["second", "first"]

    # Activity in the older chat moves it to the top.
    from app import conversations as store

    store.add_message("00000000-0000-0000-0000-000000000001", first["id"], "user", "hi")
    assert titles() == ["first", "second"]
    assert second["id"] != first["id"]


def test_list_supports_limit_and_offset():
    for n in range(3):
        new_chat(title=f"chat {n}")
    page = client.get("/conversations", params={"limit": 2, "offset": 0}).json()
    rest = client.get("/conversations", params={"limit": 2, "offset": 2}).json()
    assert [c["title"] for c in page["conversations"]] == ["chat 2", "chat 1"]
    assert [c["title"] for c in rest["conversations"]] == ["chat 0"]
    assert client.get("/conversations", params={"limit": 0}).status_code == 422


def test_get_returns_the_chat_with_no_messages_yet():
    chat = new_chat(title="empty")
    resp = client.get(f"/conversations/{chat['id']}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "empty"
    assert resp.json()["messages"] == []


def test_get_an_unknown_chat_is_404():
    assert client.get(f"/conversations/{uuid.uuid4()}").status_code == 404


def test_a_malformed_chat_id_is_rejected():
    assert client.get("/conversations/not-a-uuid").status_code == 422


def test_rename_changes_the_title():
    chat = new_chat()
    resp = client.patch(f"/conversations/{chat['id']}", json={"title": " Renamed "})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"
    assert client.get(f"/conversations/{chat['id']}").json()["title"] == "Renamed"


def test_rename_rejects_a_blank_title_and_unknown_chat():
    chat = new_chat()
    assert client.patch(f"/conversations/{chat['id']}", json={"title": " "}).status_code == 400
    assert client.patch(f"/conversations/{uuid.uuid4()}", json={"title": "x"}).status_code == 404


def test_delete_removes_the_chat_and_its_messages(fake_answer):
    chat = new_chat()
    client.post(f"/conversations/{chat['id']}/ask", json={"query": "hello"})

    assert client.delete(f"/conversations/{chat['id']}").status_code == 200
    assert client.get(f"/conversations/{chat['id']}").status_code == 404
    with db.get_cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM messages")
        assert cur.fetchone()[0] == 0


def test_delete_an_unknown_chat_is_404():
    assert client.delete(f"/conversations/{uuid.uuid4()}").status_code == 404


def test_ask_saves_the_question_and_the_answer_in_order(fake_answer):
    chat = new_chat()
    resp = client.post(f"/conversations/{chat['id']}/ask", json={"query": "what are cats?"})
    assert resp.status_code == 200
    assert resp.json()["answer"] == "a fake answer"

    messages = client.get(f"/conversations/{chat['id']}").json()["messages"]
    assert [(m["role"], m["content"]) for m in messages] == [
        ("user", "what are cats?"),
        ("assistant", "a fake answer"),
    ]
    assert all(m["status"] == "complete" for m in messages)


def test_ask_keeps_earlier_messages_when_asked_again(fake_answer):
    chat = new_chat()
    for question in ("one", "two", "three"):
        client.post(f"/conversations/{chat['id']}/ask", json={"query": question})

    messages = client.get(f"/conversations/{chat['id']}").json()["messages"]
    assert [m["content"] for m in messages if m["role"] == "user"] == ["one", "two", "three"]
    assert len(messages) == 6


def test_ask_saves_the_sources_with_the_answer(fake_answer):
    upload()
    chat = new_chat()
    resp = client.post(f"/conversations/{chat['id']}/ask", json={"query": "cats"})
    assert [s["filename"] for s in resp.json()["sources"]] == ["cats.md"]

    saved = client.get(f"/conversations/{chat['id']}").json()["messages"]
    assert [s["filename"] for s in saved[1]["sources"]] == ["cats.md"]
    assert saved[0]["sources"] is None


def test_ask_moves_the_chat_to_the_top_of_the_list(fake_answer):
    older = new_chat(title="older")
    new_chat(title="newer")
    client.post(f"/conversations/{older['id']}/ask", json={"query": "hi"})
    titles = [c["title"] for c in client.get("/conversations").json()["conversations"]]
    assert titles == ["older", "newer"]


def test_ask_rejects_an_empty_question_and_saves_nothing(fake_answer):
    chat = new_chat()
    assert client.post(f"/conversations/{chat['id']}/ask", json={"query": "  "}).status_code == 400
    assert client.get(f"/conversations/{chat['id']}").json()["messages"] == []


def test_ask_in_an_unknown_chat_is_404(fake_answer):
    resp = client.post(f"/conversations/{uuid.uuid4()}/ask", json={"query": "hi"})
    assert resp.status_code == 404


def test_a_failed_answer_saves_nothing(monkeypatch):
    def boom(query, chunks):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr("app.api.conversations.generate_answer", boom)
    chat = new_chat()

    resp = client.post(f"/conversations/{chat['id']}/ask", json={"query": "hi"})
    assert resp.status_code == 502
    assert client.get(f"/conversations/{chat['id']}").json()["messages"] == []


def test_every_chat_route_needs_a_login():
    app.dependency_overrides.pop(require_auth, None)
    chat_id = uuid.uuid4()
    calls = [
        client.get("/conversations"),
        client.post("/conversations", json={}),
        client.get(f"/conversations/{chat_id}"),
        client.patch(f"/conversations/{chat_id}", json={"title": "x"}),
        client.delete(f"/conversations/{chat_id}"),
        client.post(f"/conversations/{chat_id}/ask", json={"query": "hi"}),
    ]
    assert [c.status_code for c in calls] == [401] * 6
