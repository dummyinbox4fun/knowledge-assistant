"""Answer generation using Gemini, grounded in retrieved chunks.

The Gemini client/import is deferred until first use, same pattern as the
local embedding model — no heavy or network-dependent work happens at
module import time.
"""
from functools import lru_cache

from app.config import settings

NO_CONTEXT_MESSAGE = (
    "I don't have any relevant information in your notes to answer that."
)


@lru_cache(maxsize=1)
def _get_model():
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel(settings.gemini_model_name)


def _build_prompt(query: str, chunks: list[dict]) -> str:
    context = "\n\n".join(
        f"[Source: {chunk['filename']}]\n{chunk['content']}" for chunk in chunks
    )
    return (
        "You are a helpful assistant that answers questions using ONLY the "
        "context provided below, which comes from the user's own notes. "
        "If the answer is not contained in the context, say clearly that "
        "you don't have enough information in the notes to answer — do not "
        "make anything up or use outside knowledge.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {query}\n\n"
        "Answer:"
    )


def generate_answer(query: str, chunks: list[dict]) -> str:
    """Generate a grounded answer from the given chunks.

    Returns a canned "no information" message without calling the API at
    all if there are no chunks to ground the answer in — an empty
    knowledge base shouldn't cost an API call or risk a hallucinated
    answer with no real context behind it.
    """
    if not chunks:
        return NO_CONTEXT_MESSAGE

    prompt = _build_prompt(query, chunks)
    model = _get_model()

    try:
        response = model.generate_content(prompt)
    except Exception as e:
        raise RuntimeError(f"Gemini API call failed: {e}") from e

    return response.text
