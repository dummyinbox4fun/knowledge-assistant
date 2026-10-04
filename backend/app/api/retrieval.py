from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.embedding.embedder import embed_text
from app.vectorstore.store import query as vectorstore_query

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("/search")
def search(request: SearchRequest):
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    query_embedding = embed_text(request.query)
    results = vectorstore_query(query_embedding, top_k=request.top_k)

    return {"query": request.query, "results": results}
