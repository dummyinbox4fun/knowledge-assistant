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


def test_upload_rejects_non_md_file():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("sample.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 400


def test_upload_rejects_invalid_utf8():
    resp = client.post(
        "/ingestion/upload",
        files={"file": ("bad.md", b"\xff\xfe\x00\x01invalid", "text/markdown")},
    )
    assert resp.status_code == 400
