from unittest.mock import MagicMock

import pytest

from app.generation import generator


def test_generate_answer_with_no_chunks_returns_canned_message():
    result = generator.generate_answer("anything", [])
    assert result == generator.NO_CONTEXT_MESSAGE


def test_generate_answer_calls_model_and_returns_text(monkeypatch):
    fake_response = MagicMock()
    fake_response.text = "This is the answer."
    fake_model = MagicMock()
    fake_model.generate_content.return_value = fake_response

    monkeypatch.setattr(generator, "_get_model", lambda: fake_model)

    chunks = [{"filename": "notes.md", "position": 0, "content": "Some content."}]
    result = generator.generate_answer("What is in my notes?", chunks)

    assert result == "This is the answer."
    fake_model.generate_content.assert_called_once()


def test_generate_answer_wraps_api_errors(monkeypatch):
    fake_model = MagicMock()
    fake_model.generate_content.side_effect = Exception("rate limited")

    monkeypatch.setattr(generator, "_get_model", lambda: fake_model)

    chunks = [{"filename": "notes.md", "position": 0, "content": "Some content."}]

    with pytest.raises(RuntimeError, match="Gemini API call failed"):
        generator.generate_answer("question", chunks)


def test_prompt_includes_query_and_chunk_content():
    chunks = [{"filename": "notes.md", "position": 0, "content": "Paris is the capital of France."}]
    prompt = generator._build_prompt("What is the capital of France?", chunks)

    assert "What is the capital of France?" in prompt
    assert "Paris is the capital of France." in prompt
    assert "notes.md" in prompt
