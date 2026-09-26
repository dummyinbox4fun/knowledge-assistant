from fastapi import APIRouter, HTTPException, UploadFile

from app.ingestion.text import parse_text

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

SUPPORTED_TEXT_EXTENSIONS = (".md", ".txt")


@router.post("/upload")
async def upload_document(file: UploadFile):
    if not file.filename.endswith(SUPPORTED_TEXT_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"Only {', '.join(SUPPORTED_TEXT_EXTENSIONS)} files are accepted",
        )

    raw_bytes = await file.read()

    try:
        content = parse_text(raw_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return {
        "filename": file.filename,
        "length_chars": len(content),
        "content": content,
    }
