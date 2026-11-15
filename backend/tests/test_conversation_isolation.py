"""Each user sees and changes only their own chats (#112).

conftest.py signs every request in as one fake user. Here we switch between
two users with app.dependency_overrides, create a chat as one, and check the
other cannot list, read, rename, delete or add to it.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthUser, require_auth
from app.main import app

USER_A = "00000000-0000-0000-0000-0000000000aa"
USER_B = "00000000-0000-0000-0000-0000000000bb"

client = TestClient(app)


def as_user(user_id: str) -> None:
    app.dependency_overrides[require_auth] = lambda: AuthUser(id=user_id, email=None)


def titles() -> list[str]:
    return [c["title"] for c in client.get("/conversations").json()["conversations"]]


@pytest.fixture(autouse=True)
def fake_answer(monkeypatch):
    monkeypatch.setattr(
        "app.api.conversations.generate_answer", lambda query, chunks: "a fake answer"
    )


@pytest.fixture
def chat_of_a() -> str:
    """A chat owned by user A with one question and answer in it."""
    as_user(USER_A)
    chat_id = client.post("/conversations", json={"title": "A's private chat"}).json()["id"]
    client.post(f"/conversations/{chat_id}/ask", json={"query": "A's secret question"})
    return chat_id


def test_other_user_does_not_see_the_chat_in_their_list(chat_of_a):
    as_user(USER_B)
    assert titles() == []
    as_user(USER_A)
    assert titles() == ["A's private chat"]


def test_other_user_cannot_read_the_chat(chat_of_a):
    as_user(USER_B)
    resp = client.get(f"/conversations/{chat_of_a}")
    assert resp.status_code == 404
    assert "secret" not in resp.text


def test_a_foreign_chat_looks_exactly_like_a_missing_one(chat_of_a):
    as_user(USER_B)
    foreign = client.get(f"/conversations/{chat_of_a}")
    missing = client.get(f"/conversations/{uuid.uuid4()}")
    assert (foreign.status_code, foreign.json()) == (missing.status_code, missing.json())


def test_other_user_cannot_rename_the_chat(chat_of_a):
    as_user(USER_B)
    resp = client.patch(f"/conversations/{chat_of_a}", json={"title": "hijacked"})
    assert resp.status_code == 404

    as_user(USER_A)
    assert titles() == ["A's private chat"]


def test_other_user_cannot_delete_the_chat_and_it_survives(chat_of_a):
    as_user(USER_B)
    assert client.delete(f"/conversations/{chat_of_a}").status_code == 404

    as_user(USER_A)
    chat = client.get(f"/conversations/{chat_of_a}").json()
    assert len(chat["messages"]) == 2


def test_other_user_cannot_add_messages_to_the_chat(chat_of_a):
    as_user(USER_B)
    resp = client.post(f"/conversations/{chat_of_a}/ask", json={"query": "intruder"})
    assert resp.status_code == 404

    as_user(USER_A)
    contents = [m["content"] for m in client.get(f"/conversations/{chat_of_a}").json()["messages"]]
    assert "intruder" not in contents
    assert len(contents) == 2


def test_each_user_can_use_the_same_title():
    as_user(USER_A)
    client.post("/conversations", json={"title": "Plans"})
    as_user(USER_B)
    assert client.post("/conversations", json={"title": "Plans"}).status_code == 201
    assert titles() == ["Plans"]


def test_deleting_your_chat_leaves_the_other_users_chat():
    as_user(USER_A)
    a_chat = client.post("/conversations", json={"title": "same"}).json()["id"]
    as_user(USER_B)
    client.post("/conversations", json={"title": "same"})

    as_user(USER_A)
    assert client.delete(f"/conversations/{a_chat}").status_code == 200
    assert titles() == []

    as_user(USER_B)
    assert titles() == ["same"]
