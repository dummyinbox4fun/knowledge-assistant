"""Postgres-backed store for chats (conversations) and their messages.

Every function takes the signed-in user's id and only ever touches that
user's chats. A chat that does not exist and a chat that belongs to someone
else look the same to the caller (None / False), so the API can answer 404
for both and never reveal that another user's chat exists.
"""
from psycopg2.extras import Json

from app import db

DEFAULT_TITLE = "New chat"


def _conversation(row) -> dict:
    return {
        "id": str(row[0]),
        "title": row[1],
        "created_at": row[2].isoformat(),
        "updated_at": row[3].isoformat(),
    }


def _message(row) -> dict:
    return {
        "id": str(row[0]),
        "role": row[1],
        "content": row[2],
        "sources": row[3],
        "status": row[4],
        "created_at": row[5].isoformat(),
    }


def create_conversation(user_id: str, title: str = DEFAULT_TITLE) -> dict:
    with db.get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO conversations (user_id, title)
            VALUES (%s, %s)
            RETURNING id, title, created_at, updated_at
            """,
            (user_id, title),
        )
        return _conversation(cur.fetchone())


def list_conversations(user_id: str, limit: int = 30, offset: int = 0) -> list[dict]:
    """This user's chats, most recently active first."""
    with db.get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE user_id = %s
            ORDER BY updated_at DESC, id
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset),
        )
        return [_conversation(row) for row in cur.fetchall()]


def conversation_exists(user_id: str, conversation_id: str) -> bool:
    with db.get_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user_id),
        )
        return cur.fetchone() is not None


def get_conversation(user_id: str, conversation_id: str) -> dict | None:
    """The chat with all its messages in the order they were written, or None."""
    with db.get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE id = %s AND user_id = %s
            """,
            (conversation_id, user_id),
        )
        row = cur.fetchone()
        if row is None:
            return None
        conversation = _conversation(row)

        cur.execute(
            """
            SELECT id, role, content, sources, status, created_at
            FROM messages
            WHERE conversation_id = %s
            ORDER BY created_at, id
            """,
            (conversation_id,),
        )
        conversation["messages"] = [_message(r) for r in cur.fetchall()]
    return conversation


def rename_conversation(user_id: str, conversation_id: str, title: str) -> dict | None:
    with db.get_cursor() as cur:
        cur.execute(
            """
            UPDATE conversations SET title = %s
            WHERE id = %s AND user_id = %s
            RETURNING id, title, created_at, updated_at
            """,
            (title, conversation_id, user_id),
        )
        row = cur.fetchone()
    return _conversation(row) if row else None


def delete_conversation(user_id: str, conversation_id: str) -> bool:
    """Delete one of this user's chats; its messages go with it (cascade)."""
    with db.get_cursor() as cur:
        cur.execute(
            "DELETE FROM conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user_id),
        )
        return cur.rowcount > 0


def add_message(
    user_id: str,
    conversation_id: str,
    role: str,
    content: str,
    sources: list[dict] | None = None,
    status: str = "complete",
) -> dict | None:
    """Append a message to one of this user's chats and mark the chat as
    recently active. Returns None (and writes nothing) if the chat is not
    this user's."""
    with db.get_cursor() as cur:
        cur.execute(
            """
            UPDATE conversations SET updated_at = now()
            WHERE id = %s AND user_id = %s
            RETURNING id
            """,
            (conversation_id, user_id),
        )
        if cur.fetchone() is None:
            return None

        cur.execute(
            """
            INSERT INTO messages (conversation_id, role, content, sources, status)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, role, content, sources, status, created_at
            """,
            (
                conversation_id,
                role,
                content,
                Json(sources) if sources is not None else None,
                status,
            ),
        )
        return _message(cur.fetchone())
