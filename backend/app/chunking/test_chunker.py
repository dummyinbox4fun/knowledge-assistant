import pytest

from app.chunking.chunker import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("", chunk_size=10, overlap=2) == []


def test_text_shorter_than_chunk_size_returns_one_chunk():
    result = chunk_text("hello", chunk_size=100, overlap=10)
    assert len(result) == 1
    assert result[0]["content"] == "hello"
    assert result[0]["position"] == 0
    assert result[0]["start_char"] == 0
    assert result[0]["end_char"] == 5


def test_text_exactly_chunk_size_returns_one_chunk():
    text = "a" * 10
    result = chunk_text(text, chunk_size=10, overlap=2)
    assert len(result) == 1
    assert result[0]["content"] == text


def test_multiple_chunks_with_overlap():
    text = "abcdefghij"  # 10 chars
    result = chunk_text(text, chunk_size=4, overlap=1)
    # step = 3: starts at 0, 3, 6 — the chunk starting at 6 already
    # reaches char 10 (the end), so chunking stops there, no 4th chunk needed
    assert [c["start_char"] for c in result] == [0, 3, 6]
    assert result[0]["content"] == "abcd"
    assert result[1]["content"] == "defg"
    assert result[2]["content"] == "ghij"
    assert result[-1]["end_char"] == len(text)


def test_positions_are_sequential():
    text = "x" * 25
    result = chunk_text(text, chunk_size=10, overlap=2)
    assert [c["position"] for c in result] == list(range(len(result)))


def test_last_chunk_ends_exactly_at_text_length():
    text = "y" * 23
    result = chunk_text(text, chunk_size=10, overlap=3)
    assert result[-1]["end_char"] == len(text)


def test_invalid_chunk_size_raises():
    with pytest.raises(ValueError):
        chunk_text("hello", chunk_size=0, overlap=0)


def test_negative_overlap_raises():
    with pytest.raises(ValueError):
        chunk_text("hello", chunk_size=10, overlap=-1)


def test_overlap_equal_to_chunk_size_raises():
    with pytest.raises(ValueError):
        chunk_text("hello", chunk_size=5, overlap=5)


def test_overlap_larger_than_chunk_size_raises():
    with pytest.raises(ValueError):
        chunk_text("hello", chunk_size=5, overlap=10)
