from app.ingestion.store import (
    add_document,
    clear_documents,
    get_document_chunks,
    list_documents,
)


def setup_function():
    clear_documents()


def test_add_and_list_document():
    add_document(filename="notes.md", length_chars=100)
    docs = list_documents()
    assert len(docs) == 1
    assert docs[0]["filename"] == "notes.md"
    assert docs[0]["length_chars"] == 100
    assert "uploaded_at" in docs[0]


def test_list_documents_empty_by_default():
    assert list_documents() == []


def test_multiple_documents_preserve_order():
    add_document(filename="a.md", length_chars=10)
    add_document(filename="b.txt", length_chars=20)
    docs = list_documents()
    assert [d["filename"] for d in docs] == ["a.md", "b.txt"]


def test_add_document_stores_chunks_and_count():
    chunks = [{"content": "abc", "position": 0, "start_char": 0, "end_char": 3}]
    add_document(filename="c.md", length_chars=3, chunks=chunks)
    docs = list_documents()
    assert docs[0]["chunk_count"] == 1
    assert "chunks" not in docs[0]


def test_get_document_chunks_returns_stored_chunks():
    chunks = [{"content": "abc", "position": 0, "start_char": 0, "end_char": 3}]
    add_document(filename="c.md", length_chars=3, chunks=chunks)
    assert get_document_chunks("c.md") == chunks


def test_get_document_chunks_missing_filename_returns_none():
    assert get_document_chunks("does-not-exist.md") is None
