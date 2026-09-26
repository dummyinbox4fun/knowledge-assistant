"""In-memory store for uploaded document metadata.

v1 limitation: resets on every server restart (no DB yet — see charter
Section 2.3 non-goals). Good enough to prove the ingestion flow end to end.
"""

from datetime import datetime, timezone

_documents = []


def add_document(filename: str, length_chars: int) -> dict:
    record = {
        "filename": filename,
        "length_chars": length_chars,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    _documents.append(record)
    return record


def list_documents() -> list[dict]:
    return list(_documents)


def clear_documents() -> None:
    """Test-only helper to reset state between test cases."""
    _documents.clear()
