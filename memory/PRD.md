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
- Routing engine: task classifier (summarization/classification/extraction/reasoning/coding/rag/conversational)
  + complexity tiers (simple/moderate/complex/critical) + cheapest-fit selector
- Budget engine + auto-downgrade trigger
- Provider catalog (7 models across OpenAI / Anthropic / Gemini with cost/p95/quality)

**API endpoints** (all under `/api`)
- `POST /gateway/chat` — OpenAI-compatible drop-in; runs cache→optimize→route→call→log pipeline
- `POST /routing/decision` — pure routing reasoning, no LLM call
- `POST /cache/search` — semantic cache lookup with threshold
- `GET  /analytics/usage` — totals, by-day, by-model
- `GET  /forecast/predict` — 30/60/90-day spend with confidence bands
- `GET  /advisor/recommend` + POST action — accept/dismiss recommendation cards
- `GET  /budgets/status` — org/team/user policies + burn pct + RBAC rules
- `GET  /actions/history` — autonomous action audit log
- `GET  /providers/health` + `/routing/decisions` + `/cache/entries` + `/optimization/log`

**Frontend dashboard** (10 pages, sidebar-driven, dark Swiss control-room aesthetic)
1. Overview — savings, hit rate, token reduction, autonomous actions, cost trend, model distribution, live feed
2. Routing Intelligence — complexity pie, model bar, decisions table with reasoning
3. Semantic Cache — hit-rate chart, similarity threshold tuner slider, live probe, top entries
4. Budget Governance — org/team/user budgets with status badges + RBAC rules
5. Forecasting — 30/60/90-day chart with CI band
6. Recommendations — accept/dismiss cards, $/month impact
7. Provider Analytics — provider health grid + full models pricing table
8. Autonomous Actions — vertical timeline feed with type icons
9. Optimization Log — before/after tokens, compression ratio, quality delta
10. Playground — live `/gateway/chat` tester with full decision/optimization/cache trace

**Seeded data**: 2,371 historical requests · 940 cache hits · 4 autonomous actions · 4 recommendations ·
5 budget policies (incl. intern RBAC rules) · 7 models · 3 providers.

## Tested
Iteration 1: 18/18 backend tests + 10/10 frontend tests passed. Zero critical issues.
Real LLM calls verified (Claude Haiku classification, Gemini Flash simple routing).
L1 cache repeat-hit verified ($0.00, 1ms). Playground end-to-end verified.

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
