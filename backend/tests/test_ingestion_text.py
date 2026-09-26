import pytest

from app.ingestion.text import parse_text


def test_parse_text_valid_utf8():
    assert parse_text("plain text note".encode("utf-8")) == "plain text note"


def test_parse_text_invalid_bytes_raises():
    with pytest.raises(ValueError):
        parse_text(b"\xff\xfe\x00\x01invalid")
