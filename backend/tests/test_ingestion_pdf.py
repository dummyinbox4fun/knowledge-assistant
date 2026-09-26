from io import BytesIO

import pytest
from reportlab.pdfgen import canvas

from app.ingestion.pdf import parse_pdf


def make_test_pdf(text: str) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 720, text)
    c.save()
    return buf.getvalue()


def test_parse_pdf_extracts_text():
    pdf_bytes = make_test_pdf("Hello PDF ingestion test")
    result = parse_pdf(pdf_bytes)
    assert "Hello PDF ingestion test" in result


def test_parse_pdf_invalid_bytes_raises():
    with pytest.raises(ValueError):
        parse_pdf(b"not a real pdf")


def test_parse_pdf_blank_page_raises():
    buf = BytesIO()
    c = canvas.Canvas(buf)
    c.showPage()  # blank page, no text
    c.save()
    with pytest.raises(ValueError):
        parse_pdf(buf.getvalue())
