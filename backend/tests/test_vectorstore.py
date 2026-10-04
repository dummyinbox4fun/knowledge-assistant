import shutil

import pytest

from app.vectorstore import store


@pytest.fixture(autouse=True)
def clean_vectorstore(tmp_path, monkeypatch):
    """Point Chroma at a fresh temp dir per test and reset cached singletons.

    Without this, tests would share one persistent collection on disk and
    leak state between runs (and between this test file and a real local
    CHROMA_PATH).
    """
    monkeypatch.setattr(store.settings, "chroma_path", str(tmp_path / "chroma"))
    store._get_client.cache_clear()
    store._get_collection.cache_clear()
    yield
    store._get_client.cache_clear()
    store._get_collection.cache_clear()
    shutil.rmtree(tmp_path, ignore_errors=True)


def make_chunk(content: str, position: int, embedding: list[float]) -> dict:
    return {"content": content, "position": position, "embedding": embedding}


def test_add_and_query_round_trip():
    chunks = [
        make_chunk("the cat sat on the mat", 0, [1.0, 0.0, 0.0]),
        make_chunk("dogs are loyal animals", 1, [0.0, 1.0, 0.0]),
    ]
    store.add_chunks("pets.md", chunks)

    results = store.query([1.0, 0.0, 0.0], top_k=1)

    assert len(results) == 1
    assert results[0]["filename"] == "pets.md"
    assert results[0]["position"] == 0
    assert results[0]["content"] == "the cat sat on the mat"


def test_query_empty_store_returns_empty_list():
    results = store.query([1.0, 0.0, 0.0], top_k=5)
    assert results == []


def test_query_top_k_larger_than_store_size():
    chunks = [make_chunk("only chunk", 0, [1.0, 0.0, 0.0])]
    store.add_chunks("one.md", chunks)

    results = store.query([1.0, 0.0, 0.0], top_k=5)

    assert len(results) == 1


def test_reupload_same_filename_replaces_chunks():
    store.add_chunks("doc.md", [make_chunk("version one", 0, [1.0, 0.0, 0.0])])
    store.add_chunks("doc.md", [make_chunk("version two", 0, [0.0, 1.0, 0.0])])

    results = store.query([0.0, 1.0, 0.0], top_k=5)

    matching = [r for r in results if r["filename"] == "doc.md"]
    assert len(matching) == 1
    assert matching[0]["content"] == "version two"


def test_add_chunks_empty_list_is_noop():
    store.add_chunks("empty.md", [])
    results = store.query([1.0, 0.0, 0.0], top_k=5)
    assert results == []
