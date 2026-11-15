"""Postgres-backed store for document metadata.

Chunk content (with position/start_char/end_char) lives in the same
`chunks` table the vector store uses — this module only tracks
per-document aggregate metadata (length_chars, chunk_count, uploaded_at).
That avoids storing chunk content twice, unlike V1's split between an
in-memory document store and a separate Chroma collection.

Every function takes the signed-in user's id and only ever touches that
user's documents. A document is looked up by (user_id, display_name); the
`filename` column is an internal storage key (see
db/migrations/001_add_document_ownership.sql) that never leaves this layer.
"""
from app import db


def storage_key(user_id: str, filename: str) -> str:
    """Internal unique key for a new document: one per (user, name)."""
    return f"{user_id}:{filename}"


def add_document(
    user_id: str, filename: str, length_chars: int, chunks: list[dict] | None = None
) -> dict:
    chunks = chunks or []
    key = storage_key(user_id, filename)
    with db.get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents
                (filename, user_id, display_name, length_chars, chunk_count, uploaded_at)
            VALUES (%s, %s, %s, %s, %s, now())
            ON CONFLICT (filename) DO UPDATE
                SET length_chars = EXCLUDED.length_chars,
                    chunk_count = EXCLUDED.chunk_count,
                    uploaded_at = now()
            RETURNING display_name, length_chars, chunk_count, uploaded_at, filename
            """,
            (key, user_id, filename, length_chars, len(chunks)),
        )
        row = cur.fetchone()

    return {
        "filename": row[0],
        "length_chars": row[1],
        "chunk_count": row[2],
        "uploaded_at": row[3].isoformat(),
        # internal key, needed to attach chunks; never returned by the API
        "storage_key": row[4],
    }


def list_documents(user_id: str) -> list[dict]:
    with db.get_cursor() as cur:
        cur.execute(
            "SELECT display_name, length_chars, chunk_count, uploaded_at "
            "FROM documents WHERE user_id = %s ORDER BY uploaded_at",
            (user_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "filename": row[0],
            "length_chars": row[1],
            "chunk_count": row[2],
            "uploaded_at": row[3].isoformat(),
        }
        for row in rows
    ]


def get_document_chunks(user_id: str, filename: str) -> list[dict] | None:
    """Returns this user's document's chunks (read from the shared `chunks`
    table), or None if this user has no such document."""
    with db.get_cursor() as cur:
        cur.execute(
            "SELECT filename FROM documents WHERE user_id = %s AND display_name = %s",
            (user_id, filename),
        )
        found = cur.fetchone()
        if found is None:
            return None
        key = found[0]

        cur.execute(
            """
            SELECT position, content, start_char, end_char, embedding
            FROM chunks
            WHERE filename = %s
            ORDER BY position
            """,
            (key,),
        )
        rows = cur.fetchall()

    return [
        {
            "position": row[0],
            "content": row[1],
            "start_char": row[2],
            "end_char": row[3],
            "embedding": [float(x) for x in row[4]] if row[4] is not None else None,
        }
        for row in rows
    ]


def clear_documents() -> None:
    """Test-only helper to reset state between test cases.

    Deleting from `documents` cascades to `chunks` via the foreign key,
    so this clears both tables.
    """
    with db.get_cursor() as cur:
        cur.execute("DELETE FROM documents")


def delete_document(user_id: str, filename: str) -> bool:
    """Delete one of this user's documents and its chunks (chunks cascade
    via foreign key).

    Returns True if a document was deleted, False if this user had no
    document with that name.
    """
    with db.get_cursor() as cur:
        cur.execute(
            "DELETE FROM documents WHERE user_id = %s AND display_name = %s",
            (user_id, filename),
        )
        return cur.rowcount > 0


def document_exists(user_id: str, filename: str) -> bool:
    with db.get_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM documents WHERE user_id = %s AND display_name = %s",
            (user_id, filename),
        )
        return cur.fetchone() is not None
