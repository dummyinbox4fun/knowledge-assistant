from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthUser, require_auth
from app.ingestion.store import get_document_chunks

router = APIRouter(prefix="/embedding", tags=["embedding"])

SAMPLE_SIZE = 5  # how many vector values to show per chunk — full vectors aren't eyeball-able


@router.get("/documents/{filename}/embeddings")
def get_document_embeddings(filename: str, user: AuthUser = Depends(require_auth)):
    chunks = get_document_chunks(user.id, filename)
    if chunks is None:
        raise HTTPException(status_code=404, detail=f"No document found named '{filename}'")

    embeddings_info = []
    for chunk in chunks:
        vector = chunk.get("embedding", [])
        embeddings_info.append(
            {
                "position": chunk["position"],
                "dimension": len(vector),
                "sample_values": vector[:SAMPLE_SIZE],
            }
        )

    return {
        "filename": filename,
        "chunk_count": len(chunks),
        "embeddings": embeddings_info,
    }
