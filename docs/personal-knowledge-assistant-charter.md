# Personal Knowledge Assistant — Project Charter

> **Status:** Draft v0.1 — awaiting scope confirmation before setup begins
> **Owner:** [you]
> **Last updated:** 2026-09-24

---

## 1. Vision & Roadmap

**What this is:** A personal RAG (Retrieval-Augmented Generation) assistant that answers questions using your own notes, documents, and bookmarks — instead of generic web knowledge.

**Why this project:** Skill-building + portfolio piece, combining data engineering + AI + full-stack app dev. Built with proper engineering discipline (issues, small commits, tests, staged environments) rather than a one-shot "vibe coded" build.

**How this doc works:** This is the living master document. Section 2 is the locked scope for the *current* version being built. Section 3 is a light preview of what's next — not designed yet, just parked. When v1 ships, v2 gets its own detailed scope section (this doc gets versioned, not replaced), and the change log at the bottom tracks every scope decision.

**Time investment:** No deadline pressure. Depth and correctness over speed.

---

## 2. V1 Scope

### 2.1 Problem Statement
As a person with scattered personal notes/documents across multiple files/folders, I want to ask natural-language questions and get answers grounded in *my own* content, with the source shown — so I can trust and verify the answer instead of getting a generic AI response.

### 2.2 Goals (what v1 must prove)
- [ ] Ingest a small, fixed set of personal documents (e.g. markdown notes, PDFs)
- [ ] Chunk and embed that content into a vector store
- [ ] Retrieve relevant chunks for a given question
- [ ] Generate an answer grounded in retrieved chunks, with source citation
- [ ] Expose this via a simple web UI (not just a CLI script)
- [ ] Deploy this end-to-end across dev → staging → preprod → prod
- [ ] Have basic logging/observability so failures are visible, not silent

### 2.3 Non-Goals (explicitly deferred — not v1)
- Multi-user accounts / auth beyond a single-user access gate
- Auto-sync from external services (Notion, Google Drive, etc.)
- OCR / scanned document support
- Real-time collaborative features
- Fine-tuning any models
- Mobile app
- Advanced analytics on query history
- Cost optimization / caching layers (beyond the basics needed to function)

*(These become candidates for v2 — see Section 3.)*

### 2.4 Modules

| # | Module | Responsibility |
|---|--------|-----------------|
| 1 | **Ingestion** | Accept documents (markdown/PDF/txt) from a fixed local/uploaded source |
| 2 | **Chunking & Preprocessing** | Split documents into retrieval-sized chunks with metadata (source, position) |
| 3 | **Embedding Service** | Convert chunks into vector embeddings |
| 4 | **Vector Store** | Store & index embeddings for similarity search |
| 5 | **Retrieval Engine** | Given a query, fetch top-N relevant chunks |
| 6 | **Answer Generation (LLM layer)** | Construct prompt from retrieved chunks + query, call LLM, return grounded answer with citations |
| 7 | **API Layer** | Backend endpoints connecting UI ↔ retrieval ↔ generation |
| 8 | **Frontend / Chat UI** | Simple chat interface: ask question, see answer + sources |
| 9 | **Config & Environment Management** | Environment variables, secrets, per-env config (dev/staging/preprod/prod) |
| 10 | **Logging & Observability** | Request logs, error tracking, basic usage metrics |

### 2.5 Use Cases / User Stories

1. *As the user, I want to add a document to my knowledge base, so its content becomes searchable.*
2. *As the user, I want to ask a question in plain language, so I get an answer instead of doing manual search.*
3. *As the user, I want to see which document(s) an answer came from, so I can verify accuracy.*
4. *As the user, I want to be told when no relevant content is found, instead of getting a hallucinated answer.*
5. *As the user, I want the app to work the same way in prod as it did in dev, so I trust deployments.*
6. *As the user, I want to see basic logs/errors when something breaks, so I'm not debugging blind.*

### 2.6 Tech Stack — Free-Tier First (proposal — open for discussion)

Since this is a personal prototype, every layer is chosen to run on free tiers first. Costs/limits should be re-verified at setup time since free tiers change often.

| Layer | Choice | Why / Free tier notes |
|---|---|---|
| **LLM** | Gemini API (Flash / Flash-Lite models) | Free tier available via Google AI Studio; flagship "Pro" models are paid-only, but Flash models are sufficient for RAG Q&A. **Note:** free-tier usage may be used by Google to improve their products — acceptable for a prototype with non-sensitive notes, worth reconsidering before feeding truly private data. |
| **Embeddings** | Local, open-source (`sentence-transformers`, e.g. `bge-base-en-v1.5` or `all-mpnet-base-v2`) | Runs on your own machine — fully free, no rate limits, keeps personal notes fully private. Retrieval quality is "good enough" at personal-corpus scale vs. hosted alternatives |
| **LLM (generation)** | Gemini API (Flash / Flash-Lite models) | Reserved API usage for the layer that benefits most from a stronger hosted model |
| **Vector store** | Chroma (local/embedded, free, no hosting needed) | Zero cost, runs in-process; swap for a hosted option later only if needed |
| **Backend** | Python (FastAPI) | Free to run anywhere; strong RAG ecosystem |
| **Frontend** | React | Deployed free via Vercel/Netlify free tier |
| **Database (if needed beyond vector store)** | Supabase free tier (Postgres + auth included) | Generous free tier, gives you auth for later if v2 needs multi-user |
| **Hosting (backend)** | Render free tier | Confirmed choice |
| **CI** | GitHub Actions | Free minutes for public/personal repos |
| **Containerization** | Docker | Free, keeps dev/staging/preprod/prod consistent regardless of host |

**Status: Locked.** All layers confirmed — free-tier-first, embeddings run locally for privacy, Gemini reserved for generation.

### 2.7 Non-Functional Requirements
- **Correctness over speed:** answers must cite real sources; no silent hallucination
- **Environment parity:** same behavior across all 4 environments
- **Observability:** every failed request should be traceable in logs
- **Security (baseline):** secrets never committed; single-user access gate in non-dev environments
- **Cost awareness:** no runaway API usage (basic rate limiting acceptable)

### 2.8 Definition of Done — V1
- All modules in 2.4 implemented and covered by at least basic tests
- Deployed and verified working identically in dev, staging, preprod, and prod
- A user can add a document, ask a question, and get a cited answer — end to end, in prod
- No known critical bugs open
- This document updated to reflect what was actually built (not just planned)

---

## 3. V2 Preview (unscoped — parking lot only)
- Auto-sync from Notion/Drive/Obsidian
- Multi-document-type support (OCR, images)
- Query history + basic analytics
- Multi-user support
- Feedback loop (thumbs up/down on answers to improve retrieval)

*(Will get its own full scope section once v1 ships and is stable.)*

---

## 4. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-09-24 | Initial draft created | Project kickoff |
| 2026-09-24 | Tech stack updated to free-tier-first (Gemini instead of Claude API, Chroma, Supabase free tier, etc.) | Prototype should minimize cost; Claude API has limited free tier |
| 2026-09-24 | Stack locked: Render (hosting), React (frontend), local `sentence-transformers` (embeddings) + Gemini (generation) | Privacy for personal notes + no rate-limit risk on embeddings; API budget reserved for generation quality |

