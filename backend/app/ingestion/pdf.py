"""PDF ingestion — extracts plain text from uploaded PDF files."""

from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError


def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes.

    Raises ValueError if the file can't be read as a PDF, or if no
    extractable text is found (e.g. a scanned/image-only PDF — OCR
    is out of scope for v1, see charter Section 2.3 non-goals).
    """
    try:
        reader = PdfReader(BytesIO(file_bytes))
    except (PdfReadError, Exception) as e:
        raise ValueError("Could not read PDF file") from e

    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        text_parts.append(page_text)

    text = "\n".join(text_parts).strip()

    if not text:
        raise ValueError(
            "No extractable text found in PDF (it may be scanned/image-only, "
            "which isn't supported in v1)"
        )

    return text
