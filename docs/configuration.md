# Configuration

All settings are environment variables, loaded via `backend/app/config.py` (Pydantic `Settings`).
Copy `.env.example` to `.env` locally and fill in real values. On Render, each of the 4
services (dev/staging/preprod/prod) has its own copy of these set in its Environment tab.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ENVIRONMENT` | No | `dev` | Which environment this instance is (`dev`/`staging`/`preprod`/`prod`/`test`) |
| `GEMINI_API_KEY` | **Yes** | _(none)_ | Google AI Studio key, used for answer generation. Server refuses to start without it (except `ENVIRONMENT=test`) |
| `GEMINI_MODEL_NAME` | No | `gemini-3.5-flash-lite` | Gemini model used for generation |
| `CHROMA_PATH` | No | `./chroma_data` | Local path for the Chroma vector store (ephemeral on Render free tier) |
| `EMBEDDING_MODEL_NAME` | No | `sentence-transformers/all-MiniLM-L6-v2` | Local embedding model (384-dim). Changing this requires clearing `CHROMA_PATH` — dimension mismatch otherwise |
| `ACCESS_TOKEN` | No | _(none)_ | Reserved for future auth |
| `LOG_LEVEL` | No | `INFO` | Python logging level (`DEBUG`/`INFO`/`WARNING`/`ERROR`) |