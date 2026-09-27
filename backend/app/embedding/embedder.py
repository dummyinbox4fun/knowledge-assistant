"""Local text embedding using sentence-transformers.

Model is loaded once at module import time (not per-call) since loading
is the expensive part — reusing the same model instance across requests
is essential for reasonable performance.
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import settings


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Lazily load the model once, cached for the process lifetime.

    Using lru_cache instead of a plain module-level global so the model
    doesn't load at import time (helps test startup speed, and avoids
    loading it in processes/tests that never actually call embed_text).
    """
    return SentenceTransformer(settings.embedding_model_name)


def embed_text(text: str) -> list[float]:
    """Generate an embedding vector for a single piece of text.

    Raises ValueError for empty/whitespace-only text — an embedding of
    nothing isn't meaningful and likely indicates an upstream bug.
    """
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text")

    model = _get_model()
    vector = model.encode(text, convert_to_numpy=True)
    return vector.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch version — more efficient than calling embed_text in a loop
    since the model can process multiple texts in one forward pass."""
    if not texts:
        return []

    model = _get_model()
    vectors = model.encode(texts, convert_to_numpy=True)
    return vectors.tolist()
