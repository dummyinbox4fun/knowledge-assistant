import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.embedding.embedder import embed_text
from app.generation.generator import generate_answer
from app.vectorstore.store import query as vectorstore_query

logger = logging.getLogger("app.generation")
router = APIRouter(prefix="/generation", tags=["generation"])


class AnswerRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("/answer")
def answer(request: AnswerRequest):
    if not request.query or not request.query.strip():
        logger.warning("Answer rejected: empty query")
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    query_embedding = embed_text(request.query)
    chunks = vectorstore_query(query_embedding, top_k=request.top_k)

    try:
        answer_text = generate_answer(request.query, chunks)
    except RuntimeError as e:
        logger.error("Generation failed for query '%s...': %s", request.query[:50], str(e))
        raise HTTPException(status_code=502, detail=str(e)) from e

    logger.info(
        "Answered '%s...' using %d chunks", request.query[:50], len(chunks)
    )

    sources = [
        {
            "filename": chunk["filename"],
            "position": chunk["position"],
            "distance": chunk["distance"],
        }
        for chunk in chunks
    ]

    return {"answer": answer_text, "sources": sources}