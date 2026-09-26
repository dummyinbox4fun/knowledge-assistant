"""Shared plain-text decoding — used for .md and .txt uploads alike."""


def parse_text(file_bytes: bytes) -> str:
    """Decode uploaded plain-text file bytes to a string."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError as e:
        raise ValueError("File is not valid UTF-8 text") from e
