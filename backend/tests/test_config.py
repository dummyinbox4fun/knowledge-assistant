import pytest

from app.config import Settings, validate_required_settings


def test_validate_passes_when_environment_is_test():
    s = Settings(environment="test", gemini_api_key="")
    validate_required_settings(s)  # should not raise


def test_validate_raises_when_key_missing_outside_test():
    s = Settings(environment="dev", gemini_api_key="")
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        validate_required_settings(s)


def test_validate_passes_when_key_present():
    s = Settings(environment="dev", gemini_api_key="fake-key-value")
    validate_required_settings(s)  # should not raise