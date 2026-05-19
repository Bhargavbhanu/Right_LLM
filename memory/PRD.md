# Right LLM — Product Requirements Document

## Original problem statement
Build "Right LLM" — a production-grade enterprise SaaS that acts as an intelligent middleware
between enterprise apps and LLM providers (OpenAI, Anthropic, Gemini, Groq, Ollama, Bedrock, Azure).
Single core objective: automatically reduce enterprise LLM API costs while preserving response
quality, latency SLAs and governance controls.

## User personas
- **Enterprise Platform Engineer** — owns LLM infra, watches costs & SLAs.
- **VP Engineering / FinOps** — needs forecasting, governance, audit trail.
- **Application Developer** — calls the gateway as a drop-in OpenAI-compatible endpoint.
- **Team Lead / Intern** — subject to RBAC + budget caps.

## Architecture (matches uploaded diagram)
Enterprise Apps → Right LLM Gateway → Decision Engine →
{Semantic Cache · Routing Engine · Policy Engine · Optimization Engine} →
Provider Layer (OpenAI/Anthropic/Gemini via emergentintegrations) →
Observability & Analytics → Continuous Learning → Autonomous Action Engine → Feedback loop.

## Tech stack (adapted to platform)
- Backend: FastAPI + Motor (Mongo) + emergentintegrations (LiteLLM-equivalent)
- Frontend: React 19 + Tailwind + Shadcn UI + Recharts + lucide-react
- Cache: In-Mongo L1 exact + L2 cosine similarity (256-dim hashed n-gram embeddings)
- Auth: not implemented in MVP (DEFAULT_ORG="org_acme")
- Hosting: supervisor (backend :8001, frontend :3000)

## Implemented (2026-02-19)
**Backend engines** (`/app/backend/engines.py`)
- Token estimator, prompt optimizer (filler removal + whitespace compression)
- Embed() + cosine() for L2 semantic similarity
- Routing engine: task classifier + complexity tiers + cheapest-fit selector
  + skips configurable providers without env credentials
- Budget engine + auto-downgrade trigger
- Provider catalog: 15 models / 7 providers (OpenAI, Anthropic, Gemini live; Groq/Ollama/Bedrock/Azure configurable)

**API endpoints** (all under `/api`)
- `POST /gateway/chat` — OpenAI-compatible drop-in, multi-turn aware
- `POST /gateway/stream` — SSE with `meta`/`token`/`done` events
- `POST /routing/decision` · `POST /cache/search`
- `POST /tipe/analyze` · `POST /advisor/migration` · `POST /advisor/best-model`
- `GET  /orgs` (multi-tenant org list)
- `GET  /analytics/usage`, `/forecast/predict`, `/advisor/recommend`, `/budgets/status`,
  `/actions/history`, `/providers/health`, `/routing/decisions`, `/cache/entries`, `/optimization/log`

**Frontend dashboard** (12 pages + sidebar features)
- Sidebar with **Workspace switcher** (3 orgs persisted to localStorage) + **⌘K quick jump**
- Overview · Routing Intelligence · Semantic Cache · Budget Governance · Forecasting ·
  Recommendations · Provider Analytics · Autonomous Actions · Optimization Log ·
  TIPE Analyzer · Advisor Tools · Playground
- **Polished UX**: AnimatedNumber count-up on stat cards, LiveTicker (real-time gateway activity, 8s poll), Skeleton loaders, staggered fade-up entrance, hover lift on cards
- **Streaming Playground**: real SSE `/gateway/stream` consumption with progressive token render, live cost meter, abort/stop button, blinking cursor
- **CSV exports** on Routing Decisions, Cache Entries, Optimization Log
- **Command palette** (⌘K) with page navigation + workspace switching

**Multi-tenant**: 3 orgs seeded with distinct scale profiles
- Acme Corp (1.0x) — 42K reqs / $2.9K savings / mo
- Globex Capital (2.4x) — 99K reqs / $6.9K savings / mo
- Initech (0.35x) — 14.6K reqs / $1K savings / mo

**Deployment** (`/app/deploy/`)
- Docker Compose + Dockerfiles + nginx config + `.env.example`
- Helm chart with secret/configmap/backend/frontend/ingress + HPA templates + README

## Tested
- Iteration 1: 18/18 backend + 10/10 frontend
- Iteration 2: 26/26 backend + 12/12 frontend  
- Iteration 3: 36/36 backend + ~85% frontend; 1 UI bug (Overview stale on org switch) → **FIXED**
  by moving axios interceptor out of useEffect closure (reads localStorage each request) +
  added DialogTitle/Description to CommandPalette for Radix a11y. Verified manually via
  Playwright: Acme $2,945 → Globex $6,937 → swap is instant + smooth.

## Backlog (P1 → P2)
**P1**
- JWT + RBAC auth (currently DEFAULT_ORG bypass)
- Per-user/org rate limiting on `/gateway/chat`
- Real embeddings (OpenAI text-embedding-3-small) — requires user-supplied OpenAI key
- ANN index for L2 cache (FAISS / Mongo Atlas Vector Search) for >10k entries

**P2**
- WebSocket live-feed for autonomous actions
- Multi-turn message handling in `/gateway/chat` (currently last-user-message)
- Streaming responses (SSE)
- Provider failover policy editor
- Export usage CSV
- Stripe billing for SaaS plans
- OpenTelemetry trace export (Datadog / Honeycomb)
- K8s Helm chart + Docker Compose
- Groq / Ollama / Bedrock / Azure providers
