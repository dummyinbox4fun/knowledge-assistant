"""Central config. All env-dependent values live here — nowhere else."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "dev"
    gemini_api_key: str = ""
    chroma_path: str = "./chroma_data"
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    access_token: str = ""
    log_level: str = "INFO"
    frontend_url: str = "http://localhost:5173"
    gemini_model_name: str = "gemini-3.5-flash-lite"

    class Config:
        env_file = ".env"


settings = Settings()
