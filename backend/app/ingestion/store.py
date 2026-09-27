"""In-memory store for uploaded document metadata.

v1 limitation: resets on every server restart (no DB yet — see charter
Section 2.3 non-goals). Good enough to prove the ingestion flow end to end.
"""

from datetime import datetime, timezone

_documents = []


def add_document(filename: str, length_chars: int, chunks: list[dict] | None = None) -> dict:
    record = {
        "filename": filename,
        "length_chars": length_chars,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "chunks": chunks or [],
        "chunk_count": len(chunks) if chunks else 0,
    }
    _documents.append(record)
    return record


def list_documents() -> list[dict]:
    """Returns document metadata without the (potentially large) chunk content."""
    return [{k: v for k, v in doc.items() if k != "chunks"} for doc in _documents]


def get_document_chunks(filename: str) -> list[dict] | None:
    """Returns chunks for the most recently uploaded document with this filename,
    or None if no such document exists."""
    for doc in reversed(_documents):
        if doc["filename"] == filename:
            return doc["chunks"]
    return None


def clear_documents() -> None:
    """Test-only helper to reset state between test cases."""
    _documents.clear()
