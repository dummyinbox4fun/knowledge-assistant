import os
import sys
import pytest
sys.path.insert(0, os.path.dirname(__file__))

@pytest.fixture(autouse=True)
def isolate_vectorstore(tmp_path, monkeypatch):
    """Point every test at an isolated, throwaway Chroma path.

    Without this, any test that hits /ingestion/upload (which writes into
    the vector store as a side effect) pollutes whatever real chroma_path
    is configured locally — which turned out to be the actual local
    chroma_data/ folder used by `uvicorn` during manual testing. This
    fixture is autouse, so it applies to every test in the suite, not
    just test_vectorstore.py.
    """
    from app.config import settings
    from app.vectorstore import store

    monkeypatch.setattr(settings, "chroma_path", str(tmp_path / "chroma_test"))
    store._get_client.cache_clear()
    store._get_collection.cache_clear()
    yield
    store._get_client.cache_clear()
    store._get_collection.cache_clear()