from fastapi import APIRouter, HTTPException, UploadFile

from app.chunking.chunker import chunk_text
from app.ingestion.pdf import parse_pdf
from app.ingestion.store import add_document, list_documents
from app.ingestion.text import parse_text

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

SUPPORTED_TEXT_EXTENSIONS = (".md", ".txt")
SUPPORTED_EXTENSIONS = SUPPORTED_TEXT_EXTENSIONS + (".pdf",)


@router.post("/upload")
async def upload_document(file: UploadFile):
    if not file.filename.endswith(SUPPORTED_EXTENSIONS):
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
        raise HTTPException(status_code=400, detail=str(e)) from e

    chunks = chunk_text(content)
    add_document(filename=file.filename, length_chars=len(content), chunks=chunks)

    return {
        "filename": file.filename,
        "length_chars": len(content),
        "content": content,
        "chunk_count": len(chunks),
    }


@router.get("/documents")
def get_documents():
    return {"documents": list_documents()}
