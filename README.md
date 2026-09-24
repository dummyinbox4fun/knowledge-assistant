# Personal Knowledge Assistant

RAG-based personal knowledge assistant. See `docs/` for full scope and setup docs.

## Local dev

```bash
cp .env.example .env   # fill in GEMINI_API_KEY
docker compose -f infra/docker-compose.yml up --build
```

- Backend: http://localhost:8000/health
- Frontend: http://localhost:4173

## Structure

- `backend/` — FastAPI app (ingestion, embedding, retrieval, generation, api)
- `frontend/` — React app
- `infra/` — docker-compose, deployment config
- `docs/` — charter (v1 scope) + setup docs
- `.github/` — CI/CD workflows, issue/PR templates

## Branch → environment

| Branch | Env |
|---|---|
| `dev` | Dev |
| `staging` | Staging |
| `preprod` | Preprod |
| `main` | Prod |

Feature flow: issue → branch off `dev` → small commits → tests → PR → merge → manual promotion up the chain.
