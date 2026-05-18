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
  + skips configurable providers without env credentials
- Budget engine + auto-downgrade trigger
- Provider catalog: 15 models across **7 providers** — OpenAI, Anthropic, Gemini, Groq, Ollama, AWS Bedrock, Azure (last 4 are configurable stubs)

**API endpoints** (all under `/api`)
- `POST /gateway/chat` — OpenAI-compatible drop-in, **multi-turn aware** (full message history baked into LlmChat user_text)
- `POST /gateway/stream` — **SSE** with `meta`/`token`/`done` events
- `POST /routing/decision` — pure routing reasoning
- `POST /cache/search` — semantic cache lookup
- `POST /tipe/analyze` — TIPE Analyzer (predict tokens + per-model cost grid for a prompt × task × volume)
- `POST /advisor/migration` — Migration Simulation (from→to cost / quality / latency delta + verdict)
- `POST /advisor/best-model` — AI Model Advisor (objective + task + budget → recommended + alternates)
- `GET  /analytics/usage`, `/forecast/predict`, `/advisor/recommend`, `/budgets/status`,
  `/actions/history`, `/providers/health`, `/routing/decisions`, `/cache/entries`, `/optimization/log`

**Frontend dashboard** (12 pages, sidebar-driven, dark Swiss control-room aesthetic)
1. Overview — savings, hit rate, token reduction, autonomous actions, charts, live feed
2. Routing Intelligence — complexity pie, model bar, decisions table with reasoning
3. Semantic Cache — hit-rate chart, similarity threshold tuner, live probe
4. Budget Governance — org/team/user budgets + RBAC rules
5. Forecasting — 30/60/90-day chart with CI band
6. Recommendations — accept/dismiss cards
7. Provider Analytics — 7-provider health grid (incl. `unconfigured` state) + 15-model pricing table
8. Autonomous Actions — vertical timeline feed
9. Optimization Log — before/after tokens, compression ratio
10. **TIPE Analyzer** — task tabs, baseline model select, monthly volume slider, cost summary cards, per-model bar chart + full table (recommended row highlighted)
11. **Advisor Tools** — Migration Simulation card + AI Model Advisor card
12. Playground — live `/gateway/chat` tester with full decision/optimization/cache trace

**Deployment** (`/app/deploy/`)
- `docker-compose.yml` (mongo + backend + frontend)
- `Dockerfile.backend`, `Dockerfile.frontend`, `nginx.conf`, `.env.example`
- `helm/right-llm/` chart with `Chart.yaml`, `values.yaml`, templates for secret/config/backend/frontend/ingress + HPA
- `README.md` with run instructions

**Seeded data**: 2,300+ historical requests · 940 cache hits · 4 autonomous actions ·
4 recommendations · 5 budget policies (incl. intern RBAC rules) · 15 models · 7 providers.

## Tested
- **Iteration 1**: 18/18 backend + 10/10 frontend tests passed.
- **Iteration 2**: 26/26 backend + 12/12 frontend tests passed.
  Verified: TIPE analyze (rca_summary, classification), Migration verdict logic,
  Best-Model across 4 objectives, multi-turn LLM context recall ("Sarah"),
  SSE streaming (meta + token + done events), routing excludes unconfigured providers.

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
