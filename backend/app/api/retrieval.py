import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthUser, require_auth
from app.embedding.embedder import embed_text
from app.vectorstore.store import query as vectorstore_query

logger = logging.getLogger("app.retrieval")
router = APIRouter(prefix="/retrieval", tags=["retrieval"])


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("/search")
def search(request: SearchRequest, user: AuthUser = Depends(require_auth)):
    if not request.query or not request.query.strip():
        logger.warning("Search rejected: empty query")
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    query_embedding = embed_text(request.query)
    results = vectorstore_query(query_embedding, user.id, top_k=request.top_k)
    logger.info("Search '%s...' -> %d results", request.query[:50], len(results))

    return {"query": request.query, "results": results}
