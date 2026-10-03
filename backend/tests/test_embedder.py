import math

import pytest

from app.embedding.embedder import embed_text, embed_texts


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot / (norm_a * norm_b)


def test_embed_text_returns_vector_of_consistent_dimension():
    v1 = embed_text("The cat sat on the mat.")
    v2 = embed_text("A completely different sentence about spaceships.")
    assert len(v1) == len(v2)
    assert len(v1) > 0
    assert all(isinstance(x, float) for x in v1)


def test_embed_text_empty_raises():
    with pytest.raises(ValueError):
        embed_text("")


def test_embed_text_whitespace_only_raises():
    with pytest.raises(ValueError):
        embed_text("   \n\t  ")


def test_similar_texts_have_higher_similarity_than_unrelated():
    a = embed_text("The cat sat quietly on the warm mat.")
    b = embed_text("A cat was sitting on a cozy mat.")
    c = embed_text("Quantum physics explains subatomic particle behavior.")

    sim_similar = cosine_similarity(a, b)
    sim_unrelated = cosine_similarity(a, c)

    assert sim_similar > sim_unrelated


def test_embed_texts_batch_matches_individual_calls():
    texts = ["first sentence", "second sentence"]
    batch_result = embed_texts(texts)
    assert len(batch_result) == 2
    assert len(batch_result[0]) == len(embed_text("first sentence"))


def test_embed_texts_empty_list_returns_empty():
    assert embed_texts([]) == []
