"""Markdown ingestion — reads uploaded file bytes and returns plain text content."""


def parse_markdown(file_bytes: bytes) -> str:
    """Decode uploaded markdown file bytes to text.

    No chunking/cleaning here yet — that's a separate step (chunking module).
    This function's only job: safely turn bytes into text.
    """
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError as e:
        raise ValueError("File is not valid UTF-8 text") from e
