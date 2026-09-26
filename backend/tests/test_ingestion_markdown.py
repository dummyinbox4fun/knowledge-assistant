import pytest

from app.ingestion.markdown import parse_markdown


def test_parse_markdown_valid_utf8():
    content = parse_markdown("# Hello\nSome notes.".encode("utf-8"))
    assert content == "# Hello\nSome notes."


def test_parse_markdown_invalid_bytes_raises():
    with pytest.raises(ValueError):
        parse_markdown(b"\xff\xfe\x00\x01invalid")
