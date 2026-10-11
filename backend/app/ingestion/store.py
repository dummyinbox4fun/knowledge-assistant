"""Postgres-backed store for document metadata.

Chunk content (with position/start_char/end_char) lives in the same
`chunks` table the vector store uses — this module only tracks
per-document aggregate metadata (length_chars, chunk_count, uploaded_at).
That avoids storing chunk content twice, unlike V1's split between an
in-memory document store and a separate Chroma collection.
"""
from app import db


def add_document(filename: str, length_chars: int, chunks: list[dict] | None = None) -> dict:
    chunks = chunks or []
    with db.get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents (filename, length_chars, chunk_count, uploaded_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (filename) DO UPDATE
                SET length_chars = EXCLUDED.length_chars,
                    chunk_count = EXCLUDED.chunk_count,
                    uploaded_at = now()
            RETURNING filename, length_chars, chunk_count, uploaded_at
            """,
            (filename, length_chars, len(chunks)),
        )
        row = cur.fetchone()

    return {
        "filename": row[0],
        "length_chars": row[1],
        "chunk_count": row[2],
        "uploaded_at": row[3].isoformat(),
    }


def list_documents() -> list[dict]:
    with db.get_cursor() as cur:
        cur.execute(
            "SELECT filename, length_chars, chunk_count, uploaded_at "
            "FROM documents ORDER BY uploaded_at"
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


def get_document_chunks(filename: str) -> list[dict] | None:
    """Returns this document's chunks (read from the shared `chunks`
    table), or None if no such document exists."""
    with db.get_cursor() as cur:
        cur.execute("SELECT 1 FROM documents WHERE filename = %s", (filename,))
        if cur.fetchone() is None:
            return None

        cur.execute(
            """
            SELECT position, content, start_char, end_char, embedding
            FROM chunks
            WHERE filename = %s
            ORDER BY position
            """,
            (filename,),
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