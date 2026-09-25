from fastapi import APIRouter, HTTPException, UploadFile

from app.ingestion.markdown import parse_markdown

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post("/upload")
async def upload_markdown(file: UploadFile):
    if not file.filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files are accepted")

    raw_bytes = await file.read()

    try:
        content = parse_markdown(raw_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return {
        "filename": file.filename,
        "length_chars": len(content),
        "content": content,
    }
