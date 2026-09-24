# Personal Knowledge Assistant — Setup Document

> **Status:** Draft v0.1
> **Depends on:** `personal-knowledge-assistant-charter.md` (v1 scope — locked)
> **Last updated:** 2026-09-24

This document defines *how the project is set up* before any feature code is written: repo structure, branching, environments, containerization, CI, and the issue/PR workflow. Once this is set up and verified end-to-end (a trivial "hello world" deploy reaching all 4 environments), feature work begins.

---

## 1. Repo Structure

**Decision: Monorepo.** Simpler for a solo project — one CI pipeline, one place to track issues, no cross-repo version syncing.

```
personal-knowledge-assistant/
├── backend/                 # FastAPI app
│   ├── app/
│   │   ├── ingestion/
│   │   ├── embedding/
│   │   ├── retrieval/
│   │   ├── generation/
│   │   ├── api/
│   │   └── config.py
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                # React app
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── docker-compose.yml   # local dev — runs backend + frontend + chroma together
│   ├── docker-compose.staging.yml
│   └── render.yaml          # Render deployment config (per environment)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml           # lint + test on every PR
│   │   └── deploy.yml       # build + promote on merge to relevant branch
│   └── ISSUE_TEMPLATE/
│       └── feature.md
├── docs/
│   ├── personal-knowledge-assistant-charter.md
│   └── personal-knowledge-assistant-setup.md
├── .env.example
└── README.md
```

---

## 2. Branch Strategy → Environment Mapping

| Branch | Environment | Purpose |
|---|---|---|
| `dev` | **Dev** | Active development, merged feature branches land here first |
| `staging` | **Staging** | Stable enough to test end-to-end; promoted from `dev` manually |
| `preprod` | **Preprod** | Final check before prod — mirrors prod config/data shape | 
| `main` | **Prod** | Live version |

**Feature flow:**
```
1. Create issue (describe the feature/bug)
2. Branch from dev:  feature/issue-<number>-short-description
3. Small commits, each a working step
4. Write/update tests for the change
5. Open PR into dev → CI runs lint + tests automatically
6. Merge into dev once green
7. When dev is stable → manually promote: dev → staging → preprod → main
8. Close the issue; tag a release when merged to main
```

**Promotion is manual, not automatic** — you decide when dev is "stable enough" to push forward. This matches your pace-over-speed approach; nothing reaches prod without a deliberate decision.

---

## 3. Containerization

Each service (`backend`, `frontend`) gets its own `Dockerfile`. Locally, `infra/docker-compose.yml` runs everything together (backend + frontend + Chroma) with one command:

```bash
docker compose -f infra/docker-compose.yml up
```

This is also what guarantees parity: the *same* Docker images are what get deployed to staging/preprod/prod on Render — not a separately-installed copy of the app.

**Backend `Dockerfile`** — key points to include when we build it:
- Pinned Python version (avoid "latest" drift)
- Install deps from `requirements.txt` with locked versions
- Non-root user for the running process
- `sentence-transformers` model downloaded/cached at build time (so it's not re-downloaded on every container start)

**Frontend `Dockerfile`** — key points:
- Multi-stage build (build step → lightweight serve step) to keep the image small

*(Actual Dockerfile content gets written when we start implementation — this section just fixes the approach.)*

---

## 4. CI Pipeline (GitHub Actions)

**`ci.yml`** — runs on every PR into `dev`, `staging`, `preprod`, or `main`:
- Lint (backend: `ruff`/`flake8`; frontend: `eslint`)
- Run tests (backend: `pytest`; frontend: `vitest`/`jest`)
- Build Docker images (fail fast if the Dockerfile itself is broken)
- Block merge if any step fails

**`deploy.yml`** — runs on merge/push to `dev`, `staging`, `preprod`, `main`:
- Builds the Docker image
- Deploys to the matching Render environment
- (Later, once tests exist) could also run a smoke test against the deployed URL

*(Actual workflow YAML gets written during setup implementation — this section defines what each pipeline is responsible for.)*

---

## 5. Environment Configuration

Each environment gets its own config — never shared secrets between environments.

| Variable | Purpose |
|---|---|
| `ENVIRONMENT` | `dev` / `staging` / `preprod` / `prod` — used for environment-aware logging/config |
| `GEMINI_API_KEY` | LLM generation calls |
| `CHROMA_PATH` | Local vector store path (or connection string if moved to hosted later) |
| `EMBEDDING_MODEL_NAME` | e.g. `bge-base-en-v1.5` — kept configurable, not hardcoded |
| `ACCESS_TOKEN` | Simple single-user access gate for non-dev environments |
| `LOG_LEVEL` | Verbosity per environment (verbose in dev, quieter in prod) |

- `.env.example` committed to repo (no real values) — shows what's needed
- Real `.env` files per environment: **never committed**, stored in Render's environment variable settings per service
- `.gitignore` includes `.env`, `*.env.local`

---

## 6. Issue & PR Workflow

**Issue template (`feature.md`):**
```markdown
## What
[Short description of the feature/bug]

## Why
[Which module (from charter doc) this belongs to, and why it's needed now]

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Notes
[Any edge cases, dependencies on other issues, etc.]
```

**PR checklist (in PR description):**
```markdown
- [ ] Linked issue: #
- [ ] Tests added/updated
- [ ] Tested locally via docker-compose
- [ ] No secrets/keys committed
```

**Commit style:** small, each one a working step — e.g.
```
feat(ingestion): accept markdown file upload
feat(ingestion): parse and chunk markdown content
test(ingestion): add chunking edge case tests
```

---

## 7. Setup — Definition of Done

- [ ] Repo created with structure above
- [ ] `dev`, `staging`, `preprod`, `main` branches created
- [ ] Docker + docker-compose run a "hello world" backend + frontend locally
- [ ] CI (`ci.yml`) runs lint + a trivial test successfully on a test PR
- [ ] Deploy pipeline reaches all 4 Render environments with the "hello world" build
- [ ] `.env.example` committed; real env vars set per-environment in Render
- [ ] Issue template + PR checklist in place
- [ ] First real issue created for Module 1 (Ingestion) — ready to start v1 feature work

---

## 8. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-09-24 | Initial draft created | Following charter doc lock |
