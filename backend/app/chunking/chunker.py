"""Fixed-size chunking with overlap.

Character-based (not token-based) for v1 — avoids needing a tokenizer
dependency this early. Good enough for retrieval-sized chunks; can be
swapped for a token-aware strategy later without touching callers,
since the public shape (list of dicts) stays the same.
"""


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[dict]:
    """Split text into overlapping fixed-size chunks.

    Each chunk is a dict: {content, position, start_char, end_char}.

    Raises ValueError if chunk_size <= 0 or overlap >= chunk_size
    (an overlap that large or larger would loop forever / never advance).
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0:
        raise ValueError("overlap must be non-negative")
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    if not text:
        return []

    chunks = []
    start = 0
    position = 0
    text_length = len(text)
    step = chunk_size - overlap

    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunks.append(
            {
                "content": text[start:end],
                "position": position,
                "start_char": start,
                "end_char": end,
            }
        )
        position += 1

        if end == text_length:
            break

        start += step

    return chunks
