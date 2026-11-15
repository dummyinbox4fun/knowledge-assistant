from app.ingestion.store import add_document
from app.vectorstore import store

EMBEDDING_DIM = 384
USER = "00000000-0000-0000-0000-000000000001"


def make_vector(index: int) -> list[float]:
    """A simple one-hot 384-dim vector for testing cosine distance ordering."""
    vec = [0.0] * EMBEDDING_DIM
    vec[index] = 1.0
    return vec


def make_chunk(content: str, position: int, embedding: list[float]) -> dict:
    return {"content": content, "position": position, "embedding": embedding}


def ensure_document(filename: str) -> str:
    """chunks has a foreign key to documents(filename), matching how the
    real /ingestion/upload endpoint always creates the document row before
    writing its chunks. These tests exercise the vectorstore module
    directly, so they create that parent row themselves and get back the
    internal storage key that add_chunks needs."""
    return add_document(user_id=USER, filename=filename, length_chars=0)["storage_key"]


def test_add_and_query_round_trip():
    key = ensure_document("pets.md")
    chunks = [
        make_chunk("the cat sat on the mat", 0, make_vector(0)),
        make_chunk("dogs are loyal animals", 1, make_vector(1)),
    ]
    store.add_chunks(key, chunks)

    results = store.query(make_vector(0), USER, top_k=1)

    assert len(results) == 1
    assert results[0]["filename"] == "pets.md"
    assert results[0]["position"] == 0
    assert results[0]["content"] == "the cat sat on the mat"


def test_query_empty_store_returns_empty_list():
    results = store.query(make_vector(0), USER, top_k=5)
    assert results == []


def test_query_top_k_larger_than_store_size():
    key = ensure_document("one.md")
    chunks = [make_chunk("only chunk", 0, make_vector(0))]
    store.add_chunks(key, chunks)

    results = store.query(make_vector(0), USER, top_k=5)

    assert len(results) == 1


def test_reupload_same_filename_replaces_chunks():
    key = ensure_document("doc.md")
    store.add_chunks(key, [make_chunk("version one", 0, make_vector(0))])
    store.add_chunks(key, [make_chunk("version two", 0, make_vector(1))])

    results = store.query(make_vector(1), USER, top_k=5)

    matching = [r for r in results if r["filename"] == "doc.md"]
    assert len(matching) == 1
    assert matching[0]["content"] == "version two"


def test_add_chunks_empty_list_is_noop():
    store.add_chunks("empty.md", [])
    results = store.query(make_vector(0), USER, top_k=5)
    assert results == []
