"""Chroma-backed vector store for chunk embeddings.

Additive to the existing in-memory document store (app.ingestion.store) —
this module is the persistent index used for semantic search (Module 4),
while the in-memory store keeps backing the existing document-listing
endpoints. The two are kept in sync at upload time.

Client and collection are created lazily and cached, so importing this
module costs nothing until the first real call.
"""
from functools import lru_cache

from app.config import settings

COLLECTION_NAME = "chunks"


@lru_cache(maxsize=1)
def _get_client():
    import chromadb

    return chromadb.PersistentClient(path=settings.chroma_path)


@lru_cache(maxsize=1)
def _get_collection():
    client = _get_client()
    return client.get_or_create_collection(name=COLLECTION_NAME)


def add_chunks(filename: str, chunks: list[dict]) -> None:
    """Write/overwrite a document's chunks in the vector store.

    Each chunk dict must have: content, position, embedding.
    Uses upsert so re-uploading the same filename replaces its old chunks
    instead of duplicating them.
    """
    if not chunks:
        return

    collection = _get_collection()
    ids = [f"{filename}::{chunk['position']}" for chunk in chunks]
    embeddings = [chunk["embedding"] for chunk in chunks]
    documents = [chunk["content"] for chunk in chunks]
    metadatas = [
        {"filename": filename, "position": chunk["position"]} for chunk in chunks
    ]

    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )


def query(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """Return the top_k nearest chunks to the given query embedding.

    Returns [] if the store is empty, rather than raising — an empty
    knowledge base is a normal state, not an error.
    """
    collection = _get_collection()
    count = collection.count()
    if count == 0:
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, count),
    )

    ids = results["ids"][0]
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    return [
        {
            "filename": metadatas[i]["filename"],
            "position": metadatas[i]["position"],
            "content": documents[i],
            "distance": distances[i],
        }
        for i in range(len(ids))
    ]


def clear_collection() -> None:
    """Test-only helper: drop the collection and reset cached singletons."""
    client = _get_client()
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    _get_collection.cache_clear()
