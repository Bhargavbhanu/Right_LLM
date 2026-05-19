"""Seed historical analytics data — multi-org, enterprise-scale."""
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

ORG_ID = "org_acme"     # default for backwards-compat
ORG_NAME = "Acme Corp"

ORGS = [
    {"id": "org_acme",    "name": "Acme Corp",      "plan": "Enterprise", "scale": 1.0,
     "monthly_limit": 80000,  "used_pct": 0.42},
    {"id": "org_globex",  "name": "Globex Capital", "plan": "Enterprise", "scale": 2.4,
     "monthly_limit": 220000, "used_pct": 0.71},
    {"id": "org_initech", "name": "Initech",        "plan": "Growth",     "scale": 0.35,
     "monthly_limit": 18000,  "used_pct": 0.58},
]

SAMPLE_PROMPTS = [
    "Summarize this 12-page customer support thread and propose a polite resolution.",
    "Classify the sentiment + intent of the following enterprise product review.",
    "Extract structured fields (party, effective_date, amount, jurisdiction) from this MSA.",
    "Explain how a binary search tree achieves O(log n) lookup with worked examples.",
    "Refactor this 200-line Python pipeline for readability, edge cases and unit-test coverage.",
    "Translate this technical changelog from English to Japanese, keeping CLI flags verbatim.",
    "Reason through this multi-step Bayesian inference word problem and show all working.",
    "Generate property-based pytest suites for this JavaScript settlement-engine module.",
    "Compare and contrast PostgreSQL row-level partitioning vs. MongoDB time-series for telemetry.",
    "Hello! Can you help me draft a quick reply to this Slack message?",
    "Write a 5-line root-cause summary for a BigQuery slot-exhaustion incident on prod-data-platform.",
    "Draft a release-notes blurb for the v3.7 rollout that highlights the new vector-search feature.",
]


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

    # Providers + models (org-agnostic)
    for m in PROVIDER_CATALOG:
        await db.models.insert_one({
            "id": m["model"], "provider": m["provider"], "model": m["model"],
            "tier": m["tier"], "input_cost_per_1k": m["in"], "output_cost_per_1k": m["out"],
            "p95_latency_ms": m["p95"], "quality_score": m["quality"],
            "configurable": m.get("configurable", False),
        })
    await db.providers.insert_many([
        {"id": "openai",    "name": "OpenAI",        "health": "healthy",     "error_rate": 0.7, "p95_latency_ms": 920,  "configurable": False},
        {"id": "anthropic", "name": "Anthropic",     "health": "healthy",     "error_rate": 0.3, "p95_latency_ms": 1100, "configurable": False},
        {"id": "gemini",    "name": "Google Gemini", "health": "degraded",    "error_rate": 2.1, "p95_latency_ms": 740,  "configurable": False},
        {"id": "groq",      "name": "Groq",          "health": "unconfigured","error_rate": 0.0, "p95_latency_ms": 300,  "configurable": True},
        {"id": "ollama",    "name": "Ollama (self-hosted)", "health": "unconfigured", "error_rate": 0.0, "p95_latency_ms": 1100, "configurable": True},
        {"id": "bedrock",   "name": "AWS Bedrock",   "health": "unconfigured","error_rate": 0.0, "p95_latency_ms": 1200, "configurable": True},
        {"id": "azure",     "name": "Azure OpenAI",  "health": "unconfigured","error_rate": 0.0, "p95_latency_ms": 950,  "configurable": True},
    ])

    grand_requests = grand_hits = 0
    grand_savings = 0.0

    for ORG in ORGS:
        OID = ORG["id"]
        SCALE = ORG["scale"]

        await db.organizations.insert_one({
            "id": OID, "name": ORG["name"], "plan": ORG["plan"],
            "monthly_limit_usd": ORG["monthly_limit"],
            "created_at": now.isoformat(),
        })

        teams = [
            {"id": f"{OID}_t_platform", "org_id": OID, "name": "Platform",     "monthly_budget_usd": int(40000 * SCALE)},
            {"id": f"{OID}_t_eng",      "org_id": OID, "name": "Engineering",  "monthly_budget_usd": int(28000 * SCALE)},
            {"id": f"{OID}_t_data",     "org_id": OID, "name": "Data Science", "monthly_budget_usd": int(18000 * SCALE)},
            {"id": f"{OID}_t_support",  "org_id": OID, "name": "Support AI",   "monthly_budget_usd": int(12000 * SCALE)},
        ]
        await db.teams.insert_many(teams)

        users = [
            {"id": f"{OID}_admin",  "org_id": OID, "email": f"admin@{OID.split('_')[1]}.com", "role": "admin",    "team_id": teams[0]["id"]},
            {"id": f"{OID}_eng",    "org_id": OID, "email": f"eng@{OID.split('_')[1]}.com",   "role": "engineer", "team_id": teams[1]["id"]},
            {"id": f"{OID}_intern", "org_id": OID, "email": f"intern@{OID.split('_')[1]}.com","role": "intern",   "team_id": teams[1]["id"]},
        ]
        await db.users.insert_many(users)

        # Budget policies
        await db.budget_policies.insert_many([
            {"id": f"{OID}_bp_org",   "scope": "org",  "scope_id": OID,
             "monthly_limit_usd": ORG["monthly_limit"],
             "used_usd": round(ORG["monthly_limit"] * ORG["used_pct"], 2), "soft_pct": 0.8, "org_id": OID},
            *[{"id": f"{t['id']}_bp", "scope": "team", "scope_id": t["id"],
               "monthly_limit_usd": t["monthly_budget_usd"],
               "used_usd": round(t["monthly_budget_usd"] * random.uniform(0.35, 0.92), 2),
               "soft_pct": 0.8, "org_id": OID} for t in teams],
            {"id": f"{OID}_bp_intern", "scope": "user", "scope_id": f"{OID}_intern",
             "monthly_limit_usd": int(500 * SCALE), "used_usd": round(380 * SCALE, 2), "soft_pct": 0.8,
             "rbac_rules": ["block:claude-opus-4-5-20251101", "block:gpt-4o", "max_tokens:2000"], "org_id": OID},
        ])

        # Requests / decisions / opts / usage — last 30 days
        reqs, decisions, opts, usage = [], [], [], []
        cache_entries = {}
        org_hits = 0
        org_savings = 0.0
        for d in range(30):
            day = now - timedelta(days=29 - d)
            # 1000–2200 requests/day for biggest org, scales linearly
            n = int((1000 + d * 24 + random.randint(-80, 160)) * SCALE)
            for _ in range(n):
                prompt = random.choice(SAMPLE_PROMPTS)
                real_models = [m for m in PROVIDER_CATALOG if not m.get("configurable")]
                model = random.choices(real_models, weights=[20, 18, 14, 12, 10, 8, 3][:len(real_models)], k=1)[0]

                # Enterprise-scale tokens: 4000-40000 input, 1500-9000 output
                in_raw = random.randint(4000, 40000)
                saved = int(in_raw * random.uniform(0.18, 0.38))
                in_tokens = in_raw - saved
                out_tokens = random.randint(1500, 9000)
                cost = estimate_cost(in_tokens, out_tokens, model)
                gpt4o = next(m for m in PROVIDER_CATALOG if m["model"] == "gpt-4o")
                gpt4o_cost = estimate_cost(in_tokens, out_tokens, gpt4o)

                is_hit = random.random() < 0.41
                if is_hit:
                    org_hits += 1
                    saved_cost = gpt4o_cost   # full baseline saved when cache served
                    cost = 0.0
                else:
                    saved_cost = max(0.0, gpt4o_cost - cost)
                org_savings += saved_cost

                ts = (day + timedelta(seconds=random.randint(0, 86400))).isoformat()
                rid = str(uuid.uuid4())
                team = random.choice(teams)
                user = random.choice(users)
                reqs.append({"id": rid, "org_id": OID, "user_id": user["id"], "team_id": team["id"],
                             "prompt": prompt, "timestamp": ts, "cache_hit": is_hit,
                             "model": model["model"], "provider": model["provider"]})
                decisions.append({"id": str(uuid.uuid4()), "request_id": rid, "org_id": OID,
                                  "task": random.choice(["summarization", "classification", "extraction", "reasoning", "coding", "conversational"]),
                                  "complexity": model["tier"], "model": model["model"], "provider": model["provider"],
                                  "reasoning": f"Routed to {model['provider']}/{model['model']} based on task complexity '{model['tier']}'.",
                                  "timestamp": ts, "cost_usd": round(cost, 6),
                                  "baseline_cost_usd": round(gpt4o_cost, 6), "savings_usd": round(saved_cost, 6)})
                opts.append({"id": str(uuid.uuid4()), "request_id": rid, "org_id": OID,
                             "before_tokens": in_raw, "after_tokens": in_tokens, "saved_tokens": saved,
                             "compression_ratio": round(saved / in_raw, 4),
                             "quality_delta": round(random.uniform(-0.01, 0.02), 4), "timestamp": ts})
                usage.append({"id": str(uuid.uuid4()), "request_id": rid, "org_id": OID,
                              "model": model["model"], "provider": model["provider"],
                              "input_tokens": in_tokens, "output_tokens": out_tokens,
                              "cost_usd": round(cost, 6), "timestamp": ts})

        if reqs:
            await db.requests.insert_many(reqs)
            await db.routing_decisions.insert_many(decisions)
            await db.optimization_actions.insert_many(opts)
            await db.token_usage.insert_many(usage)
        grand_requests += len(reqs)
        grand_hits += org_hits
        grand_savings += org_savings

        # Cache entries
        for p in SAMPLE_PROMPTS:
            cache_entries[p] = {
                "id": str(uuid.uuid4()), "org_id": OID, "prompt": p,
                "response": "(cached response preview…)",
                "model": "anthropic/claude-haiku-4-5-20251001",
                "hit_count": int(random.randint(80, 940) * SCALE),
                "similarity_threshold": 0.92,
                "created_at": (now - timedelta(days=random.randint(1, 20))).isoformat(),
                "last_hit_at": (now - timedelta(hours=random.randint(0, 48))).isoformat(),
            }
        await db.cache_entries.insert_many(list(cache_entries.values()))

        # Recommendations — scaled to org size
        await db.recommendations.insert_many([
            {"id": str(uuid.uuid4()), "org_id": OID, "title": "Move classification workloads off GPT-4o",
             "description": f"Last 30 days: {int(28000 * SCALE):,} classification requests on GPT-4o. Gemini 2.5 Flash achieves 94% quality on this task at 1/30th the cost.",
             "estimated_monthly_savings_usd": int(4280 * SCALE * 8), "category": "routing", "status": "pending", "created_at": now.isoformat()},
            {"id": str(uuid.uuid4()), "org_id": OID, "title": "Enable semantic cache for support summarization",
             "description": f"Detected high-volume prompt cluster ({int(1920 * SCALE):,} hits) with 67% similarity ≥ 0.93. Activating L2 cache saves ~${int(1950 * SCALE * 6):,}/mo.",
             "estimated_monthly_savings_usd": int(1950 * SCALE * 6), "category": "cache", "status": "pending", "created_at": now.isoformat()},
            {"id": str(uuid.uuid4()), "org_id": OID, "title": "Tighten prompt template for extraction tasks",
             "description": "Average prompt has 312 tokens of fixed preamble that compresses to 94 tokens with no quality drop.",
             "estimated_monthly_savings_usd": int(820 * SCALE * 5), "category": "optimization", "status": "pending", "created_at": now.isoformat()},
            {"id": str(uuid.uuid4()), "org_id": OID, "title": "Downgrade intern tier to Haiku-only",
             "description": "Interns are using GPT-4o for 41% of requests. Hard-cap to Haiku will save without quality risk on internal tasks.",
             "estimated_monthly_savings_usd": int(640 * SCALE * 3), "category": "governance", "status": "pending", "created_at": now.isoformat()},
        ])

        # Autonomous actions
        await db.autonomous_actions.insert_many([
            {"id": str(uuid.uuid4()), "org_id": OID, "type": "rerouted_traffic",
             "summary": "Gemini latency P95 exceeded 1500ms — rerouted 20% traffic to OpenAI",
             "outcome": "Latency P95 restored to 740ms in 4 minutes",
             "timestamp": (now - timedelta(hours=2)).isoformat(), "reversible": True, "status": "active"},
            {"id": str(uuid.uuid4()), "org_id": OID, "type": "downgraded_model",
             "summary": "Engineering team budget burn at 81% — auto-downgraded GPT-4o → Claude Haiku",
             "outcome": f"Projected ${int(4100 * SCALE):,} savings for remainder of month",
             "timestamp": (now - timedelta(hours=7)).isoformat(), "reversible": True, "status": "active"},
            {"id": str(uuid.uuid4()), "org_id": OID, "type": "activated_cache",
             "summary": "Detected prompt cluster repetition (84 hits/hr) — activated semantic cache",
             "outcome": "Hit rate climbed from 12% → 43% in 1 hour",
             "timestamp": (now - timedelta(days=1, hours=3)).isoformat(), "reversible": True, "status": "completed"},
            {"id": str(uuid.uuid4()), "org_id": OID, "type": "failover",
             "summary": "OpenAI error rate spiked to 6.4% — failed over to Anthropic",
             "outcome": "Error rate back under 0.5% within 90s",
             "timestamp": (now - timedelta(days=2)).isoformat(), "reversible": False, "status": "completed"},
        ])

    print(f"Seeded {len(ORGS)} orgs · {grand_requests:,} requests · {grand_hits:,} cache hits · savings ≈ ${grand_savings:,.2f}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
