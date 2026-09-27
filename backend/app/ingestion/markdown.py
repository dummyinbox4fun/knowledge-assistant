"""Markdown ingestion — reads uploaded file bytes and returns plain text content."""

from app.ingestion.text import parse_text


def parse_markdown(file_bytes: bytes) -> str:
    """Decode uploaded markdown file bytes to text.

    No chunking/cleaning here yet — that's a separate step (chunking module).
    Markdown decoding is currently identical to plain-text decoding;
    kept as its own function so markdown-specific handling (e.g. front-matter)
    can be added later without touching the shared text parser.
    """
    return parse_text(file_bytes)
