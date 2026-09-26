from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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


def test_upload_rejects_unsupported_file_type():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("sample.pdf", b"hello", "application/pdf")},
    )
    assert resp.status_code == 400


def test_upload_rejects_invalid_utf8():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("bad.md", b"\xff\xfe\x00\x01invalid", "text/markdown")},
    )
    assert resp.status_code == 400
