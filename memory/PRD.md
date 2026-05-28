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

**Frontend dashboard** (13 pages + sidebar features)
- Sidebar with **Workspace switcher** (3 orgs persisted to localStorage) + **⌘K quick jump**
- Overview · Routing Intelligence · Semantic Cache · Budget Governance · Forecasting ·
  Recommendations · Provider Analytics · Autonomous Actions · Optimization Log ·
  TIPE Analyzer · Advisor Tools · Playground · **Guide**
- **Floating Chatbot** ("Ask Right LLM") — eats our own dog food via `/api/gateway/stream`,
  shows routed model + cost + latency per response, system-prompted with full product knowledge
- **Polished UX**: AnimatedNumber count-up on stat cards, LiveTicker (real-time gateway activity, 8s poll), Skeleton loaders, staggered fade-up entrance, hover lift on cards
- **Streaming Playground**: real SSE `/gateway/stream` consumption with progressive token render, live cost meter, abort/stop button, blinking cursor
- **CSV exports** on Routing Decisions, Cache Entries, Optimization Log
- **Command palette** (⌘K) with page navigation + workspace switching
- **Guide page**: enterprise-grade documentation — hero ("Cut your LLM bill in half"),
  6 benefit cards, 7-engine deep-dive, 8-step decision pipeline, 12-page tour,
  cURL + Python + JS-streaming code snippets, expandable FAQ, CTA to Playground

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
- Iteration 4 (2026-02-28): 36/36 backend + ~98% frontend after platform-wide UI/UX
  overhaul. New `Card.jsx` design-system (`Surface`, `StatCard`, `SectionCard`, `Pill`,
  `EmptyState`) applied across 12 pages. Playground rewritten with preset chips, model
  picker (Auto + 15 models), demo-mode warning for configurable providers, live cost meter,
  routing-decision panel with task/complexity pills, optimization compression bar, session
  history (last 5 runs), spinner inside Stream button. AdvisorTools polished with
  quality-Δ units ("(pts)" + "on 0–100 scale"), %-vs-baseline cost delta, and `demo · needs
  API key` pill on configurable-provider recommendations. SSE streaming verified end-to-end
  with cache HIT (L1) returning 1ms; routing decision arrives via `event: meta`, tokens
  stream via `event: token`. No regressions; sidebar nav, workspace switcher and CSV export
  remain functional.

- Iteration 5–6 (2026-02-28): JWT auth + RBAC + Settings page for provider keys + slowapi
  rate-limit + brute-force lockout. Three critical defects found by testing agent and fixed
  same iteration: (a) `from __future__ import annotations` + `Body(...)` default broke
  pydantic 2 body parsing on /gateway/{chat,stream} → removed `__future__` import. (b) auth
  users were colliding with the domain `db.users` collection used by /budgets/status → moved
  auth to `db.auth_users`. (c) `locked_until` tz-naive vs `now()` tz-aware → normalize on
  read. (d) lockout keyed by `{ip}:{email}` failed under multi-replica k8s ingress → re-key
  by email-only (better security anyway). Final result: 36/36 backend + 17/17 auth-suite +
  100% frontend (admin login → topbar PA avatar → Settings page → 4 provider cards with
  Fernet-encrypted Groq/Ollama/Bedrock/Azure key vault → live ↔ not-configured pill;
  member login hides settings nav). New endpoints: POST /api/auth/{register,login,logout},
  GET /api/auth/me, GET/PUT/DELETE /api/settings/providers (admin-only).

## Backlog (P1 → P2)
**P1**
- ~~JWT + RBAC auth~~ ✅ done (iter-5/6)
- ~~Per-org rate limiting on `/gateway/*`~~ ✅ done (slowapi 60/min)
- Real embeddings (OpenAI text-embedding-3-small via Emergent LLM key) — currently uses a
  deterministic md5-based pseudo-embedding (fine for demo / <5k cache entries)
- ANN index for L2 cache (FAISS / Mongo Atlas Vector Search) — defer until cache > 10k
  entries; current linear-scan cosine works fine in MongoDB up to that point
- **Backend modularization** — split `server.py` (~770 lines) into `routes/`, `models/`,
  `services/` packages; add structured request-id logging middleware

**P2**
- WebSocket live-feed for autonomous actions
- Multi-turn message handling in `/gateway/chat` (currently last-user-message)
- Stripe billing for SaaS plans
- OpenTelemetry trace export (Datadog / Honeycomb)
- K8s Helm chart + Docker Compose
- ~~Streaming responses (SSE)~~ ✅ done
- ~~Export usage CSV~~ ✅ done
- ~~Settings UI to paste provider API keys~~ ✅ done (iter-5)
- Refresh tokens / sliding window
- Email verification + password reset flow
