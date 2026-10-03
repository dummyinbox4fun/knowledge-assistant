import math

import pytest

from app.embedding.similarity import cosine_similarity


def test_identical_vectors_have_similarity_one():
    v = [1.0, 2.0, 3.0]
    assert math.isclose(cosine_similarity(v, v), 1.0, rel_tol=1e-9)


def test_orthogonal_vectors_have_similarity_zero():
    a = [1.0, 0.0]
    b = [0.0, 1.0]
    assert math.isclose(cosine_similarity(a, b), 0.0, abs_tol=1e-9)


def test_opposite_vectors_have_similarity_negative_one():
    a = [1.0, 0.0]
    b = [-1.0, 0.0]
    assert math.isclose(cosine_similarity(a, b), -1.0, rel_tol=1e-9)


def test_similarity_is_scale_invariant():
    a = [1.0, 2.0, 3.0]
    b = [2.0, 4.0, 6.0]  # same direction, different magnitude
    assert math.isclose(cosine_similarity(a, b), 1.0, rel_tol=1e-9)


def test_empty_vector_raises():
    with pytest.raises(ValueError):
        cosine_similarity([], [1.0, 2.0])


def test_mismatched_length_raises():
    with pytest.raises(ValueError):
        cosine_similarity([1.0, 2.0], [1.0, 2.0, 3.0])


def test_zero_vector_raises():
    with pytest.raises(ValueError):
        cosine_similarity([0.0, 0.0], [1.0, 2.0])
