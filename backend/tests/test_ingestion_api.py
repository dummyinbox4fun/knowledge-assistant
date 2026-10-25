from io import BytesIO

from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.ingestion.store import clear_documents
from app.main import app

client = TestClient(app)

# Same id conftest.py's fake login uses
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


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


def test_upload_response_includes_chunk_count():
    file_content = b"a" * 1200  # long enough to produce multiple chunks at default size
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("long.txt", file_content, "text/plain")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["chunk_count"] > 1


def test_documents_list_includes_chunk_count_not_chunks():
    client.post(
        "/ingestion/upload",
        files={"file": ("sample.md", b"# Hello", "text/markdown")},
    )
    resp = client.get("/ingestion/documents")
    docs = resp.json()["documents"]
    assert docs[0]["chunk_count"] == 1
    assert "chunks" not in docs[0]  # list endpoint shouldn't dump full chunk content


def test_get_chunks_for_uploaded_document():
    file_content = b"a" * 1200
    client.post(
        "/ingestion/upload",
        files={"file": ("chunked.txt", file_content, "text/plain")},
    )
    resp = client.get("/ingestion/documents/chunked.txt/chunks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "chunked.txt"
    assert data["chunk_count"] > 1
    assert len(data["chunks"]) == data["chunk_count"]
    assert "content" in data["chunks"][0]


def test_get_chunks_for_missing_document_returns_404():
    resp = client.get("/ingestion/documents/does-not-exist.md/chunks")
    assert resp.status_code == 404


def test_chunks_endpoint_does_not_leak_embedding_vectors():
    client.post(
        "/ingestion/upload",
        files={"file": ("sample.md", b"# Hello world", "text/markdown")},
    )
    resp = client.get("/ingestion/documents/sample.md/chunks")
    data = resp.json()
    assert "embedding" not in data["chunks"][0]


def test_uploaded_chunks_have_embeddings_stored_internally():
    # Verifies embeddings are actually generated and stored (not just
    # hidden from the API) by checking the store directly.
    from app.ingestion.store import get_document_chunks

    client.post(
        "/ingestion/upload",
        files={"file": ("embedded.md", b"# Some content to embed", "text/markdown")},
    )
    chunks = get_document_chunks(TEST_USER_ID, "embedded.md")
    assert len(chunks) > 0
    assert "embedding" in chunks[0]
    assert len(chunks[0]["embedding"]) > 0
    assert isinstance(chunks[0]["embedding"][0], float)


def test_upload_rejects_invalid_utf8():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("bad.md", b"\xff\xfe\x00\x01invalid", "text/markdown")},
    )
    assert resp.status_code == 400

def test_delete_document_removes_it():
    client.post(
        "/ingestion/upload",
        files={"file": ("to_delete.md", b"# Delete me", "text/markdown")},
    )
    resp = client.delete("/ingestion/documents/to_delete.md")
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "to_delete.md"
    assert data["deleted"] is True

    list_resp = client.get("/ingestion/documents")
    filenames = [doc["filename"] for doc in list_resp.json()["documents"]]
    assert "to_delete.md" not in filenames


def test_delete_missing_document_returns_404():
    resp = client.delete("/ingestion/documents/does-not-exist.md")
    assert resp.status_code == 404


def test_delete_document_also_removes_its_chunks():
    client.post(
        "/ingestion/upload",
        files={"file": ("with_chunks.md", b"# Some content", "text/markdown")},
    )
    client.delete("/ingestion/documents/with_chunks.md")

    resp = client.get("/ingestion/documents/with_chunks.md/chunks")
    assert resp.status_code == 404


def test_upload_duplicate_filename_rejected():
    client.post(
        "/ingestion/upload",
        files={"file": ("dup.md", b"# Original content", "text/markdown")},
    )
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("dup.md", b"# Second attempt", "text/markdown")},
    )
    assert resp.status_code == 409

def test_upload_duplicate_filename_does_not_overwrite_original():
    client.post(
        "/ingestion/upload",
        files={"file": ("dup2.md", b"# Original content", "text/markdown")},
    )
    client.post(
        "/ingestion/upload",
        files={"file": ("dup2.md", b"# Second attempt", "text/markdown")},
    )

    resp = client.get("/ingestion/documents/dup2.md/chunks")
    data = resp.json()
    assert "Original content" in data["chunks"][0]["content"]


def test_upload_same_filename_succeeds_after_deletion():
    client.post(
        "/ingestion/upload",
        files={"file": ("dup3.md", b"# Original content", "text/markdown")},
    )
    client.delete("/ingestion/documents/dup3.md")

    resp = client.post(
        "/ingestion/upload",
        files={"file": ("dup3.md", b"# New content after delete", "text/markdown")},
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "# New content after delete"
