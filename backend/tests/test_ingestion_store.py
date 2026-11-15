from app.ingestion.store import (
    add_document,
    clear_documents,
    get_document_chunks,
    list_documents,
)

USER = "00000000-0000-0000-0000-000000000001"


def setup_function():
    clear_documents()


def test_add_and_list_document():
    add_document(user_id=USER, filename="notes.md", length_chars=100)
    docs = list_documents(USER)
    assert len(docs) == 1
    assert docs[0]["filename"] == "notes.md"
    assert docs[0]["length_chars"] == 100
    assert "uploaded_at" in docs[0]


def test_list_documents_empty_by_default():
    assert list_documents(USER) == []


def test_multiple_documents_preserve_order():
    add_document(user_id=USER, filename="a.md", length_chars=10)
    add_document(user_id=USER, filename="b.txt", length_chars=20)
    docs = list_documents(USER)
    assert [d["filename"] for d in docs] == ["a.md", "b.txt"]


def test_add_document_stores_chunks_and_count():
    chunks = [{"content": "abc", "position": 0, "start_char": 0, "end_char": 3}]
    add_document(user_id=USER, filename="c.md", length_chars=3, chunks=chunks)
    docs = list_documents(USER)
    assert docs[0]["chunk_count"] == 1
    assert "chunks" not in docs[0]


def test_get_document_chunks_returns_stored_chunks():
    from app.vectorstore.store import add_chunks

    chunks = [
        {
            "content": "abc",
            "position": 0,
            "start_char": 0,
            "end_char": 3,
            "embedding": [0.0] * 384,
        }
    ]
    document = add_document(user_id=USER, filename="c.md", length_chars=3, chunks=chunks)
    add_chunks(document["storage_key"], chunks)

    result = get_document_chunks(USER, "c.md")
    assert len(result) == 1
    assert result[0]["content"] == "abc"
    assert result[0]["position"] == 0
    assert result[0]["start_char"] == 0
    assert result[0]["end_char"] == 3

def test_get_document_chunks_missing_filename_returns_none():
    assert get_document_chunks(USER, "does-not-exist.md") is None
