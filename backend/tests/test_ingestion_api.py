from io import BytesIO

from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.ingestion.store import clear_documents
from app.main import app

client = TestClient(app)


def setup_function():
    clear_documents()


def make_test_pdf(text: str) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 720, text)
    c.save()
    return buf.getvalue()


def test_upload_markdown_success():
    file_content = b"# Test\nSome sample content."
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("sample.md", file_content, "text/markdown")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "sample.md"
    assert data["content"] == "# Test\nSome sample content."
    assert data["length_chars"] == len(file_content)


def test_upload_txt_success():
    file_content = b"Plain text note content."
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("sample.txt", file_content, "text/plain")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "sample.txt"
    assert data["content"] == "Plain text note content."


def test_upload_pdf_success():
    pdf_bytes = make_test_pdf("Hello from API test PDF")
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("sample.pdf", pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "sample.pdf"
    assert "Hello from API test PDF" in data["content"]


def test_upload_corrupt_pdf_rejected():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("bad.pdf", b"not a real pdf", "application/pdf")},
    )
    assert resp.status_code == 400


def test_upload_rejects_unsupported_file_type():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("sample.docx", b"hello", "application/msword")},
    )
    assert resp.status_code == 400


def test_documents_list_empty_initially():
    resp = client.get("/ingestion/documents")
    assert resp.status_code == 200
    assert resp.json()["documents"] == []


def test_documents_list_after_upload():
    client.post(
        "/ingestion/upload",
        files={"file": ("sample.md", b"# Hello", "text/markdown")},
    )
    resp = client.get("/ingestion/documents")
    assert resp.status_code == 200
    docs = resp.json()["documents"]
    assert len(docs) == 1
    assert docs[0]["filename"] == "sample.md"


def test_upload_rejects_invalid_utf8():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("bad.md", b"\xff\xfe\x00\x01invalid", "text/markdown")},
    )
    assert resp.status_code == 400
