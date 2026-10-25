"""Central config. All env-dependent values live here — nowhere else."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "dev"
    gemini_api_key: str = ""
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    log_level: str = "INFO"
    frontend_url: str = "http://localhost:5173"
    gemini_model_name: str = "gemini-3.5-flash-lite"
    database_url: str = ""
    rate_limit: str = "100/minute"
    supabase_url: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()


def validate_required_settings(settings: "Settings") -> None:
    """Fail fast and loud if a required setting is missing.

    Skipped entirely under pytest (ENVIRONMENT=test) so the test suite
    never needs real credentials.
    """
    if settings.environment == "test":
        return

    missing = []
    if not settings.gemini_api_key:
        missing.append("GEMINI_API_KEY")
    if not settings.database_url:
        missing.append("DATABASE_URL")
    if not settings.supabase_url:
        missing.append("SUPABASE_URL")

    if missing:
        raise RuntimeError(
            "Missing required environment variable(s): "
            f"{', '.join(missing)}. Set them before starting the server. "
            "See docs/configuration.md."
        )