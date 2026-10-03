"""Cosine similarity between two embedding vectors.

Standalone from embedder.py since this is pure math with no model
dependency — keeps it trivially testable without loading the model.
"""

import math


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Returns a value in [-1, 1] — 1 means identical direction (very
    similar meaning), 0 means unrelated, -1 means opposite.

    Raises ValueError if vectors are empty or of different length —
    comparing embeddings from different models/dimensions isn't
    meaningful and likely indicates a bug upstream.
    """
    if not a or not b:
        raise ValueError("Cannot compute similarity of an empty vector")
    if len(a) != len(b):
        raise ValueError(
            f"Vectors must be the same length (got {len(a)} and {len(b)})"
        )

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))

    if norm_a == 0 or norm_b == 0:
        raise ValueError("Cannot compute similarity of a zero vector")

    return dot / (norm_a * norm_b)
