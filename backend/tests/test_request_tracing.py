from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_response_includes_request_id_header():
    response = client.get("/health")
    assert "x-request-id" in response.headers
    assert len(response.headers["x-request-id"]) > 0


def test_two_requests_get_different_request_ids():
    first = client.get("/health")
    second = client.get("/health")
    assert first.headers["x-request-id"] != second.headers["x-request-id"]


def test_incoming_request_id_header_is_echoed_back():
    response = client.get("/health", headers={"X-Request-ID": "fixed-test-id-123"})
    assert response.headers["x-request-id"] == "fixed-test-id-123"