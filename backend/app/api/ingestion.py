from fastapi import APIRouter, HTTPException, UploadFile
from app.vectorstore.store import add_chunks as add_chunks_to_vectorstore
from app.chunking.chunker import chunk_text
from app.embedding.embedder import embed_texts
from app.ingestion.pdf import parse_pdf
from app.ingestion.store import add_document, get_document_chunks, list_documents
from app.ingestion.text import parse_text
import logging
logger = logging.getLogger("app.ingestion")
router = APIRouter(prefix="/ingestion", tags=["ingestion"])

SUPPORTED_TEXT_EXTENSIONS = (".md", ".txt")
SUPPORTED_EXTENSIONS = SUPPORTED_TEXT_EXTENSIONS + (".pdf",)


@router.post("/upload")
async def upload_document(file: UploadFile):
    if not file.filename.endswith(SUPPORTED_EXTENSIONS):
        logger.warning("Upload rejected for %s: unsupported file type", file.filename)
        raise HTTPException(
            status_code=400,
            detail=f"Only {', '.join(SUPPORTED_EXTENSIONS)} files are accepted",
        )

    raw_bytes = await file.read()

    try:
        if file.filename.endswith(".pdf"):
            content = parse_pdf(raw_bytes)
        else:
            content = parse_text(raw_bytes)
    except ValueError as e:
        logger.warning("Upload rejected for %s: %s", file.filename, str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e

    chunks = chunk_text(content)

    chunk_texts = [chunk["content"] for chunk in chunks]
    embeddings = embed_texts(chunk_texts)
    for chunk, embedding in zip(chunks, embeddings):
        chunk["embedding"] = embedding

    add_document(filename=file.filename, length_chars=len(content), chunks=chunks)
    logger.info("Uploaded %s (%d chunks)", file.filename, len(chunks))
    try:
        add_chunks_to_vectorstore(file.filename, chunks)
    except Exception:
        pass
    return {
        "filename": file.filename,
        "length_chars": len(content),
        "content": content,
        "chunk_count": len(chunks),
    }


@router.get("/documents")
def get_documents():
    return {"documents": list_documents()}


@router.get("/documents/{filename}/chunks")
def get_document_chunks_endpoint(filename: str):
    chunks = get_document_chunks(filename)
    if chunks is None:
        raise HTTPException(status_code=404, detail=f"No document found named '{filename}'")

    # Strip embedding vectors here — this endpoint is for eyeballing chunk
    # text/boundaries (see #11); full embeddings are what #14's dedicated
    # inspection endpoint is for. Keeping them out avoids bloating this
    # response with hundreds of floats per chunk.
    chunks_without_embeddings = [
        {k: v for k, v in chunk.items() if k != "embedding"} for chunk in chunks
    ]

    return {
        "filename": filename,
        "chunk_count": len(chunks),
        "chunks": chunks_without_embeddings,
    }
