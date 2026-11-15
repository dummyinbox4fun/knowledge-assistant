import pytest

from app.config import Settings, validate_required_settings


def test_validate_passes_when_environment_is_test():
    s = Settings(
        environment="test", gemini_api_key="", database_url="", supabase_url=""
    )
    validate_required_settings(s)  # should not raise


def test_validate_raises_when_key_missing_outside_test():
    s = Settings(
        environment="dev",
        gemini_api_key="",
        database_url="fake-db-url",
        supabase_url="https://x.supabase.co",
    )
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        validate_required_settings(s)


def test_validate_raises_when_database_url_missing_outside_test():
    s = Settings(
        environment="dev",
        gemini_api_key="fake-key-value",
        database_url="",
        supabase_url="https://x.supabase.co",
    )
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        validate_required_settings(s)


def test_validate_raises_when_supabase_url_missing_outside_test():
    s = Settings(
        environment="dev",
        gemini_api_key="fake-key-value",
        database_url="fake-db-url",
        supabase_url="",
    )
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        validate_required_settings(s)


def test_validate_passes_when_all_required_settings_present():
    s = Settings(
        environment="dev",
        gemini_api_key="fake-key-value",
        database_url="fake-db-url",
        supabase_url="https://x.supabase.co",
    )
    validate_required_settings(s)  # should not raise


def test_unknown_lines_in_env_are_ignored(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("ACCESS_TOKEN=leftover\nLOG_LEVEL=DEBUG\n")
    s = Settings(_env_file=str(env_file))
    assert s.log_level == "DEBUG"
