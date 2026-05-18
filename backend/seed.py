"""Seed historical analytics data for the dashboard."""
import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from engines import PROVIDER_CATALOG, estimate_cost

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

ORG_ID = "org_acme"
ORG_NAME = "Acme Corp"


async def seed() -> None:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Wipe & reseed (idempotent)
    for c in [
        "organizations", "users", "teams", "providers", "models",
        "requests", "responses", "token_usage", "routing_decisions",
        "cache_entries", "optimization_actions", "recommendations",
        "forecast_reports", "budget_policies", "audit_logs", "autonomous_actions",
    ]:
        await db[c].delete_many({})

    now = datetime.now(timezone.utc)

    # Org / users / teams
    await db.organizations.insert_one({
        "id": ORG_ID, "name": ORG_NAME, "plan": "Enterprise",
        "created_at": now.isoformat(),
    })
    await db.users.insert_many([
        {"id": "u_admin", "org_id": ORG_ID, "email": "admin@acme.com", "role": "admin",  "team_id": "t_platform"},
        {"id": "u_eng",   "org_id": ORG_ID, "email": "eng@acme.com",   "role": "engineer", "team_id": "t_eng"},
        {"id": "u_intern","org_id": ORG_ID, "email": "intern@acme.com","role": "intern", "team_id": "t_eng"},
    ])
    await db.teams.insert_many([
        {"id": "t_platform", "org_id": ORG_ID, "name": "Platform",   "monthly_budget_usd": 12000},
        {"id": "t_eng",      "org_id": ORG_ID, "name": "Engineering","monthly_budget_usd": 8000},
        {"id": "t_data",     "org_id": ORG_ID, "name": "Data Science","monthly_budget_usd": 5000},
    ])

    # Providers + models
    for m in PROVIDER_CATALOG:
        await db.models.insert_one({
            "id": m["model"], "provider": m["provider"], "model": m["model"],
            "tier": m["tier"], "input_cost_per_1k": m["in"], "output_cost_per_1k": m["out"],
            "p95_latency_ms": m["p95"], "quality_score": m["quality"],
        })
    providers_meta = [
        {"id": "openai",    "name": "OpenAI",        "health": "healthy",     "error_rate": 0.7, "p95_latency_ms": 920,  "configurable": False},
        {"id": "anthropic", "name": "Anthropic",     "health": "healthy",     "error_rate": 0.3, "p95_latency_ms": 1100, "configurable": False},
        {"id": "gemini",    "name": "Google Gemini", "health": "degraded",    "error_rate": 2.1, "p95_latency_ms": 740,  "configurable": False},
        {"id": "groq",      "name": "Groq",          "health": "unconfigured","error_rate": 0.0, "p95_latency_ms": 300,  "configurable": True},
        {"id": "ollama",    "name": "Ollama (self-hosted)", "health": "unconfigured", "error_rate": 0.0, "p95_latency_ms": 1100, "configurable": True},
        {"id": "bedrock",   "name": "AWS Bedrock",   "health": "unconfigured","error_rate": 0.0, "p95_latency_ms": 1200, "configurable": True},
        {"id": "azure",     "name": "Azure OpenAI",  "health": "unconfigured","error_rate": 0.0, "p95_latency_ms": 950,  "configurable": True},
    ]
    await db.providers.insert_many(providers_meta)

    # Budget policies
    await db.budget_policies.insert_many([
        {"id": "bp_org",   "scope": "org",  "scope_id": ORG_ID,      "monthly_limit_usd": 25000, "used_usd": 14820.0, "soft_pct": 0.8},
        {"id": "bp_eng",   "scope": "team", "scope_id": "t_eng",     "monthly_limit_usd": 8000,  "used_usd": 6480.0,  "soft_pct": 0.8},
        {"id": "bp_data",  "scope": "team", "scope_id": "t_data",    "monthly_limit_usd": 5000,  "used_usd": 2110.0,  "soft_pct": 0.8},
        {"id": "bp_plat",  "scope": "team", "scope_id": "t_platform","monthly_limit_usd": 12000, "used_usd": 6230.0,  "soft_pct": 0.8},
        {"id": "bp_intern","scope": "user", "scope_id": "u_intern",  "monthly_limit_usd": 200,   "used_usd": 178.0,   "soft_pct": 0.8,
         "rbac_rules": ["block:claude-opus-4-5-20251101", "block:gpt-4o", "max_tokens:2000"]},
    ])

    # Historical requests (30 days)
    sample_prompts = [
        "Summarize this customer support email and suggest a response.",
        "Classify the sentiment of the following product review.",
        "Extract structured fields (name, email, phone) from this text.",
        "Explain how a binary search tree works step by step.",
        "Refactor this Python function for readability and edge cases.",
        "Translate the following paragraph from English to Spanish.",
        "Reason through this multi-step math word problem carefully.",
        "Generate unit tests for this JavaScript module.",
        "Compare and contrast PostgreSQL vs MongoDB for analytics workloads.",
        "Hello! Can you help me draft a quick reply?",
    ]
    requests_docs, decisions_docs, opt_docs, usage_docs = [], [], [], []
    cache_entries: dict[str, dict] = {}
    cache_hit_count = miss_count = 0
    total_savings = 0.0
    for d in range(30):
        day = now - timedelta(days=29 - d)
        # 60–110 requests per day, increasing over time
        n = 60 + d + random.randint(-5, 15)
        for _ in range(n):
            prompt = random.choice(sample_prompts)
            # Historical data uses only the 7 non-configurable providers (real LLM calls happen via these)
            real_models = [m for m in PROVIDER_CATALOG if not m.get("configurable")]
            model = random.choices(
                real_models,
                weights=[20, 18, 14, 12, 10, 8, 3][:len(real_models)],
                k=1,
            )[0]
            in_tokens_raw = random.randint(120, 1400)
            saved = int(in_tokens_raw * random.uniform(0.18, 0.38))
            in_tokens = in_tokens_raw - saved
            out_tokens = random.randint(80, 600)
            cost = estimate_cost(in_tokens, out_tokens, model)
            gpt4o_cost = estimate_cost(in_tokens, out_tokens, next(m for m in PROVIDER_CATALOG if m["model"] == "gpt-4o"))
            saved_cost = max(0.0, gpt4o_cost - cost)
            total_savings += saved_cost

            is_cache_hit = random.random() < 0.38
            if is_cache_hit:
                cache_hit_count += 1
                cost = 0.0
            else:
                miss_count += 1

            ts = (day + timedelta(seconds=random.randint(0, 86400))).isoformat()
            rid = str(uuid.uuid4())
            requests_docs.append({
                "id": rid, "org_id": ORG_ID, "user_id": random.choice(["u_admin", "u_eng", "u_intern"]),
                "team_id": random.choice(["t_eng", "t_data", "t_platform"]),
                "prompt": prompt, "timestamp": ts,
                "cache_hit": is_cache_hit, "model": model["model"], "provider": model["provider"],
            })
            decisions_docs.append({
                "id": str(uuid.uuid4()), "request_id": rid, "org_id": ORG_ID,
                "task": random.choice(["summarization", "classification", "extraction", "reasoning", "coding", "conversational"]),
                "complexity": model["tier"], "model": model["model"], "provider": model["provider"],
                "reasoning": f"Routed to {model['provider']}/{model['model']} based on task complexity '{model['tier']}'.",
                "timestamp": ts, "cost_usd": round(cost, 6), "baseline_cost_usd": round(gpt4o_cost, 6),
                "savings_usd": round(saved_cost, 6),
            })
            opt_docs.append({
                "id": str(uuid.uuid4()), "request_id": rid, "org_id": ORG_ID,
                "before_tokens": in_tokens_raw, "after_tokens": in_tokens, "saved_tokens": saved,
                "compression_ratio": round(saved / in_tokens_raw, 4),
                "quality_delta": round(random.uniform(-0.01, 0.02), 4),
                "timestamp": ts,
            })
            usage_docs.append({
                "id": str(uuid.uuid4()), "request_id": rid, "org_id": ORG_ID,
                "model": model["model"], "provider": model["provider"],
                "input_tokens": in_tokens, "output_tokens": out_tokens,
                "cost_usd": round(cost, 6), "timestamp": ts,
            })

    await db.requests.insert_many(requests_docs)
    await db.routing_decisions.insert_many(decisions_docs)
    await db.optimization_actions.insert_many(opt_docs)
    await db.token_usage.insert_many(usage_docs)

    # Cache entries (representative)
    for p in sample_prompts:
        cache_entries[p] = {
            "id": str(uuid.uuid4()), "org_id": ORG_ID, "prompt": p,
            "response": "(cached response preview…)",
            "model": "anthropic/claude-haiku-4-5-20251001",
            "hit_count": random.randint(15, 240),
            "similarity_threshold": 0.92,
            "created_at": (now - timedelta(days=random.randint(1, 20))).isoformat(),
            "last_hit_at": (now - timedelta(hours=random.randint(0, 48))).isoformat(),
        }
    await db.cache_entries.insert_many(list(cache_entries.values()))

    # Recommendations
    await db.recommendations.insert_many([
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "title": "Move classification workloads off GPT-4o",
         "description": "Last 30 days: 8,142 classification requests on GPT-4o. Gemini 2.5 Flash achieves 94% quality on this task at 1/30th the cost.",
         "estimated_monthly_savings_usd": 4280, "category": "routing", "status": "pending", "created_at": now.isoformat()},
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "title": "Enable semantic cache for support summarization",
         "description": "Detected a high-volume prompt cluster (1,920 hits) with 67% semantic similarity ≥ 0.93. Activating L2 cache will save ~$1,950/mo.",
         "estimated_monthly_savings_usd": 1950, "category": "cache", "status": "pending", "created_at": now.isoformat()},
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "title": "Tighten prompt template for extraction tasks",
         "description": "Average prompt has 312 tokens of fixed preamble that compresses to 94 tokens with no quality drop.",
         "estimated_monthly_savings_usd": 820, "category": "optimization", "status": "pending", "created_at": now.isoformat()},
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "title": "Downgrade intern tier to Haiku-only",
         "description": "Interns are using GPT-4o for 41% of requests. Hard-cap to Haiku will save without quality risk on internal tasks.",
         "estimated_monthly_savings_usd": 640, "category": "governance", "status": "pending", "created_at": now.isoformat()},
    ])

    # Autonomous actions
    await db.autonomous_actions.insert_many([
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "type": "rerouted_traffic",
         "summary": "Gemini latency P95 exceeded 1500ms — rerouted 20% traffic to OpenAI",
         "outcome": "Latency P95 restored to 740ms in 4 minutes",
         "timestamp": (now - timedelta(hours=2)).isoformat(), "reversible": True, "status": "active"},
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "type": "downgraded_model",
         "summary": "Engineering team budget burn at 81% — auto-downgraded GPT-4o → Claude Haiku for non-critical tasks",
         "outcome": "Projected $410 savings for remainder of month",
         "timestamp": (now - timedelta(hours=7)).isoformat(), "reversible": True, "status": "active"},
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "type": "activated_cache",
         "summary": "Detected prompt cluster repetition (84 hits/hr) — activated semantic cache",
         "outcome": "Hit rate climbed from 12% → 43% in 1 hour",
         "timestamp": (now - timedelta(days=1, hours=3)).isoformat(), "reversible": True, "status": "completed"},
        {"id": str(uuid.uuid4()), "org_id": ORG_ID, "type": "failover",
         "summary": "OpenAI error rate spiked to 6.4% — failed over to Anthropic",
         "outcome": "Error rate back under 0.5% within 90s",
         "timestamp": (now - timedelta(days=2)).isoformat(), "reversible": False, "status": "completed"},
    ])

    print(f"Seeded: {len(requests_docs)} requests, {cache_hit_count} cache hits, savings ≈ ${total_savings:,.2f}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
