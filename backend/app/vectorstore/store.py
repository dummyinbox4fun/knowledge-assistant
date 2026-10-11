"""Postgres + pgvector backed vector store for chunk embeddings.

Replaces the Chroma-based store (V1) — this one lives in an external
Postgres database instead of the ephemeral local filesystem, so it
survives Render restarts/redeploys.
"""
from app import db


def add_chunks(filename: str, chunks: list[dict]) -> None:
    """Write/overwrite a document's chunks in the vector store.

    Each chunk dict must have: content, position, embedding (start_char
    and end_char are optional, used for display purposes only).
    Deletes any existing chunks for this filename first, so re-uploading
    the same filename replaces its old chunks instead of duplicating them.
    """
    if not chunks:
        return

    with db.get_cursor() as cur:
        cur.execute("DELETE FROM chunks WHERE filename = %s", (filename,))
        for chunk in chunks:
            cur.execute(
                """
                INSERT INTO chunks
                    (filename, position, content, start_char, end_char, embedding)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    filename,
                    chunk["position"],
                    chunk["content"],
                    chunk.get("start_char"),
                    chunk.get("end_char"),
                    chunk["embedding"],
                ),
            )


def query(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """Return the top_k nearest chunks to the given query embedding.

    Returns [] if the store is empty, rather than raising — an empty
    knowledge base is a normal state, not an error. Uses pgvector's
    cosine distance operator (<=>), matching the "lower distance = more
    similar" semantics the rest of the app already assumes.
    """
    with db.get_cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM chunks")
        count = cur.fetchone()[0]
        if count == 0:
            return []

        cur.execute(
            """
            SELECT filename, position, content, embedding <=> %s::vector AS distance
            FROM chunks
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (query_embedding, query_embedding, min(top_k, count)),
        )
        rows = cur.fetchall()

    return [
        {
            "filename": row[0],
            "position": row[1],
            "content": row[2],
            "distance": float(row[3]),
        }
        for row in rows
    ]


def clear_collection() -> None:
    """Test-only helper: remove all chunks."""
    with db.get_cursor() as cur:
        cur.execute("DELETE FROM chunks")