"""Local text embedding using sentence-transformers.

Both the `sentence_transformers` import AND the model itself are deferred
until the first actual embedding call — not done at module import time.
Importing sentence_transformers/torch is itself heavy (memory + time),
and doing it eagerly at server startup was choking free-tier hosts with
limited RAM before the app could even bind its port. Deferring it means
server startup stays cheap; only the first real embedding request pays
the cost (and by then the model is already cached in the Docker image
from the build step, so it's just an import/load, not a download).
"""

from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def _get_model():
    """Lazily import sentence_transformers AND load the model, once,
    cached for the process lifetime."""
    from sentence_transformers import SentenceTransformer

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
