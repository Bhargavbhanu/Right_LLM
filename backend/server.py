"""Right LLM — FastAPI gateway + analytics backend."""
from __future__ import annotations

import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from engines import (
    PROVIDER_CATALOG,
    classify_task,
    cosine,
    embed,
    estimate_cost,
    estimate_tokens,
    optimize_prompt,
    prune_messages,
    route,
    select_model,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ─── DB ────────────────────────────────────────────────────────────────────
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# ─── App ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Right LLM Gateway")
api = APIRouter(prefix="/api")

DEFAULT_ORG = "org_acme"

# ─── Models ────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: Optional[str] = None
    quality_floor: float = 0.78
    use_cache: bool = True
    similarity_threshold: float = 0.92
    org_id: str = DEFAULT_ORG
    user_id: str = "u_admin"
    team_id: str = "t_eng"


class RoutingRequest(BaseModel):
    prompt: str
    quality_floor: float = 0.78
    budget_remaining_pct: float = 1.0


class CacheSearchRequest(BaseModel):
    prompt: str
    similarity_threshold: float = 0.92
    org_id: str = DEFAULT_ORG


# ─── LLM call ──────────────────────────────────────────────────────────────
CONFIGURABLE_PROVIDERS = {"groq", "ollama", "bedrock", "azure"}


def _is_configurable(provider: str) -> bool:
    return provider in CONFIGURABLE_PROVIDERS


def _format_history(messages: list[dict]) -> tuple[str, str]:
    """Return (system_message, multi_turn_user_text) compatible with LlmChat."""
    system = next((m["content"] for m in messages if m["role"] == "system"), "")
    convo = [m for m in messages if m["role"] != "system"]
    if len(convo) <= 1:
        return system, convo[-1]["content"] if convo else ""
    # Bake prior turns into the user text so the single-turn LlmChat sees full context.
    lines = ["Previous conversation:"]
    for m in convo[:-1]:
        role = "USER" if m["role"] == "user" else "ASSISTANT"
        lines.append(f"{role}: {m['content']}")
    lines.append("")
    lines.append(f"Current message: {convo[-1]['content']}")
    return system, "\n".join(lines)


async def call_llm(provider: str, model: str, messages: list[dict]) -> dict:
    """Real LLM call via emergentintegrations. Supports multi-turn."""
    if _is_configurable(provider):
        env_var = {"groq": "GROQ_API_KEY", "ollama": "OLLAMA_BASE_URL",
                   "bedrock": "AWS_ACCESS_KEY_ID", "azure": "AZURE_OPENAI_API_KEY"}[provider]
        if not os.environ.get(env_var):
            raise HTTPException(
                status_code=501,
                detail=f"Provider '{provider}' requires {env_var}. Configure the key in backend/.env to enable live calls. It still appears in routing, analyzer and advisor based on its published pricing.",
            )
        raise HTTPException(status_code=501, detail=f"Provider '{provider}' adapter not wired in MVP.")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")
    system, user_text = _format_history(messages)
    chat = LlmChat(
        api_key=api_key,
        session_id=str(uuid.uuid4()),
        system_message=system or "You are a helpful assistant.",
    ).with_model(provider, model)
    t0 = time.time()
    text = await chat.send_message(UserMessage(text=user_text))
    latency_ms = int((time.time() - t0) * 1000)
    return {"text": str(text), "latency_ms": latency_ms}


# ─── Gateway endpoint ──────────────────────────────────────────────────────
@api.post("/gateway/chat")
async def gateway_chat(req: ChatRequest) -> dict[str, Any]:
    started = time.time()
    # 1. Pull user prompt (last user message)
    user_msgs = [m for m in req.messages if m.role == "user"]
    if not user_msgs:
        raise HTTPException(400, "No user message provided")
    raw_prompt = user_msgs[-1].content
    system_msg = next((m.content for m in req.messages if m.role == "system"), "")

    # 2. Optimization
    opt = optimize_prompt(raw_prompt)
    pruned_messages = prune_messages([m.model_dump() for m in req.messages])
    # Rewrite the last user message to be the optimized version for the LLM call.
    if pruned_messages and pruned_messages[-1]["role"] == "user":
        pruned_messages[-1] = {**pruned_messages[-1], "content": opt["compressed"]}

    # 3. Semantic cache lookup
    cache_hit = None
    vec = embed(opt["compressed"])
    if req.use_cache:
        # L1 exact
        exact = await db.cache_entries.find_one(
            {"org_id": req.org_id, "prompt": opt["compressed"]}, {"_id": 0}
        )
        if exact:
            cache_hit = {"layer": "L1", "similarity": 1.0, "entry": exact}
        else:
            # L2 semantic — scan recent N entries (small for demo)
            cursor = db.cache_entries.find({"org_id": req.org_id}, {"_id": 0}).limit(500)
            best, best_sim = None, 0.0
            async for entry in cursor:
                ev = entry.get("embedding")
                if not ev:
                    ev = embed(entry["prompt"])
                sim = cosine(vec, ev)
                if sim > best_sim:
                    best_sim, best = sim, entry
            if best and best_sim >= req.similarity_threshold:
                cache_hit = {"layer": "L2", "similarity": round(best_sim, 4), "entry": best}

    # 4. Budget lookup
    org_budget = await db.budget_policies.find_one({"scope": "org", "scope_id": req.org_id}, {"_id": 0})
    remaining_pct = 1.0
    if org_budget and org_budget.get("monthly_limit_usd"):
        remaining_pct = max(0.0, 1.0 - org_budget["used_usd"] / org_budget["monthly_limit_usd"])

    # 5. Routing decision
    decision = route(opt["compressed"], quality_floor=req.quality_floor, budget_remaining_pct=remaining_pct)
    model = decision["model"]
    if req.model:
        forced = next((m for m in PROVIDER_CATALOG if m["model"] == req.model), None)
        if forced:
            model = forced
            decision["model"] = model
            decision["reasoning"] += f" (user override → {model['model']})"

    # 6. Cache return
    if cache_hit:
        cost = 0.0
        latency_ms = int((time.time() - started) * 1000)
        # update hit count
        await db.cache_entries.update_one(
            {"id": cache_hit["entry"]["id"]},
            {"$inc": {"hit_count": 1}, "$set": {"last_hit_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {
            "id": str(uuid.uuid4()),
            "response": cache_hit["entry"]["response"],
            "cache_hit": True,
            "cache_layer": cache_hit["layer"],
            "similarity": cache_hit["similarity"],
            "model": cache_hit["entry"].get("model", "cache"),
            "cost_usd": cost,
            "latency_ms": latency_ms,
            "optimization": opt,
            "decision": _decision_summary(decision),
        }

    # 7. Real LLM call
    try:
        llm_out = await call_llm(model["provider"], model["model"], pruned_messages)
        response_text = llm_out["text"]
        provider_latency = llm_out["latency_ms"]
        status = "ok"
        error = None
    except Exception as e:  # pragma: no cover
        response_text = ""
        provider_latency = int((time.time() - started) * 1000)
        status = "error"
        error = str(e)

    out_tokens = estimate_tokens(response_text)
    in_tokens = opt["after_tokens"]
    cost_usd = estimate_cost(in_tokens, out_tokens, model)
    baseline_cost = estimate_cost(in_tokens, out_tokens, next(m for m in PROVIDER_CATALOG if m["model"] == "gpt-4o"))
    savings = max(0.0, baseline_cost - cost_usd)

    # 8. Persist
    req_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.requests.insert_one({
        "id": req_id, "org_id": req.org_id, "user_id": req.user_id, "team_id": req.team_id,
        "prompt": opt["compressed"], "timestamp": now_iso,
        "cache_hit": False, "model": model["model"], "provider": model["provider"], "status": status,
    })
    await db.routing_decisions.insert_one({
        "id": str(uuid.uuid4()), "request_id": req_id, "org_id": req.org_id,
        "task": decision["task"], "complexity": decision["selected_complexity"],
        "model": model["model"], "provider": model["provider"],
        "reasoning": decision["reasoning"], "timestamp": now_iso,
        "cost_usd": round(cost_usd, 6), "baseline_cost_usd": round(baseline_cost, 6),
        "savings_usd": round(savings, 6),
    })
    await db.optimization_actions.insert_one({
        "id": str(uuid.uuid4()), "request_id": req_id, "org_id": req.org_id,
        "before_tokens": opt["before_tokens"], "after_tokens": opt["after_tokens"],
        "saved_tokens": opt["saved_tokens"], "compression_ratio": opt["compression_ratio"],
        "quality_delta": 0.0, "timestamp": now_iso,
    })
    await db.token_usage.insert_one({
        "id": str(uuid.uuid4()), "request_id": req_id, "org_id": req.org_id,
        "model": model["model"], "provider": model["provider"],
        "input_tokens": in_tokens, "output_tokens": out_tokens,
        "cost_usd": round(cost_usd, 6), "timestamp": now_iso,
    })
    if status == "ok":
        await db.cache_entries.insert_one({
            "id": str(uuid.uuid4()), "org_id": req.org_id, "prompt": opt["compressed"],
            "response": response_text, "embedding": vec,
            "model": f"{model['provider']}/{model['model']}",
            "hit_count": 0, "similarity_threshold": req.similarity_threshold,
            "created_at": now_iso, "last_hit_at": now_iso,
        })
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "org_id": req.org_id, "request_id": req_id,
        "action": "gateway_chat", "status": status, "error": error, "timestamp": now_iso,
    })

    total_latency = int((time.time() - started) * 1000)
    return {
        "id": req_id,
        "response": response_text,
        "cache_hit": False,
        "model": model["model"],
        "provider": model["provider"],
        "cost_usd": round(cost_usd, 6),
        "baseline_cost_usd": round(baseline_cost, 6),
        "savings_usd": round(savings, 6),
        "latency_ms": total_latency,
        "provider_latency_ms": provider_latency,
        "optimization": opt,
        "decision": _decision_summary(decision),
        "status": status,
        "error": error,
    }


def _decision_summary(d: dict) -> dict:
    return {
        "task": d["task"],
        "complexity": d.get("selected_complexity", d["complexity"]),
        "downgraded_due_to_budget": d.get("downgraded_due_to_budget", False),
        "model": d["model"]["model"],
        "provider": d["model"]["provider"],
        "reasoning": d["reasoning"],
    }


# ─── Routing decision (no LLM call) ────────────────────────────────────────
@api.post("/routing/decision")
async def routing_decision(req: RoutingRequest) -> dict:
    d = route(req.prompt, quality_floor=req.quality_floor, budget_remaining_pct=req.budget_remaining_pct)
    return _decision_summary(d) | {"model_details": d["model"]}


# ─── Cache search ──────────────────────────────────────────────────────────
@api.post("/cache/search")
async def cache_search(req: CacheSearchRequest) -> dict:
    vec = embed(req.prompt)
    cursor = db.cache_entries.find({"org_id": req.org_id}, {"_id": 0}).limit(500)
    best, best_sim = None, 0.0
    async for entry in cursor:
        ev = entry.get("embedding") or embed(entry["prompt"])
        sim = cosine(vec, ev)
        if sim > best_sim:
            best_sim, best = sim, entry
    return {
        "hit": bool(best and best_sim >= req.similarity_threshold),
        "similarity": round(best_sim, 4),
        "threshold": req.similarity_threshold,
        "entry": best,
    }


# ─── Analytics ─────────────────────────────────────────────────────────────
@api.get("/analytics/usage")
async def analytics_usage(org_id: str = DEFAULT_ORG, days: int = 30) -> dict:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    usage = await db.token_usage.find({"org_id": org_id, "timestamp": {"$gte": cutoff}}, {"_id": 0}).to_list(200000)
    decisions = await db.routing_decisions.find({"org_id": org_id, "timestamp": {"$gte": cutoff}}, {"_id": 0}).to_list(200000)
    opts = await db.optimization_actions.find({"org_id": org_id, "timestamp": {"$gte": cutoff}}, {"_id": 0}).to_list(200000)
    requests = await db.requests.find({"org_id": org_id, "timestamp": {"$gte": cutoff}}, {"_id": 0}).to_list(200000)

    total_cost = sum(u["cost_usd"] for u in usage)
    total_in = sum(u["input_tokens"] for u in usage)
    total_out = sum(u["output_tokens"] for u in usage)
    cache_hits = sum(1 for r in requests if r.get("cache_hit"))
    total_reqs = len(requests)
    hit_rate = (cache_hits / total_reqs) if total_reqs else 0
    # Build a map request_id → routing decision (for cache savings attribution)
    dec_by_req = {d.get("request_id"): d for d in decisions if d.get("request_id")}
    routing_savings = 0.0
    cache_savings = 0.0
    for r in requests:
        d = dec_by_req.get(r["id"])
        if not d:
            continue
        if r.get("cache_hit"):
            cache_savings += d.get("savings_usd", 0)
        else:
            routing_savings += d.get("savings_usd", 0)
    total_savings = routing_savings + cache_savings
    total_before = sum(o["before_tokens"] for o in opts) or 1
    total_after = sum(o["after_tokens"] for o in opts) or 1
    reduction = 1 - (total_after / total_before)

    # by-day
    by_day: dict[str, dict] = {}
    for u in usage:
        d = u["timestamp"][:10]
        x = by_day.setdefault(d, {"date": d, "cost": 0.0, "input_tokens": 0, "output_tokens": 0, "requests": 0, "cache_hits": 0})
        x["cost"] += u["cost_usd"]
        x["input_tokens"] += u["input_tokens"]
        x["output_tokens"] += u["output_tokens"]
        x["requests"] += 1
    for r in requests:
        d = r["timestamp"][:10]
        if d in by_day and r.get("cache_hit"):
            by_day[d]["cache_hits"] += 1
    series = sorted(by_day.values(), key=lambda x: x["date"])
    for s in series:
        s["cost"] = round(s["cost"], 4)
        s["hit_rate"] = round((s["cache_hits"] / s["requests"]) if s["requests"] else 0, 4)

    # by-model
    by_model: dict[str, dict] = {}
    for u in usage:
        m = u["model"]
        x = by_model.setdefault(m, {"model": m, "provider": u["provider"], "cost": 0.0, "requests": 0, "tokens": 0})
        x["cost"] += u["cost_usd"]
        x["requests"] += 1
        x["tokens"] += u["input_tokens"] + u["output_tokens"]
    by_model_list = [{**v, "cost": round(v["cost"], 4)} for v in by_model.values()]

    return {
        "totals": {
            "requests": total_reqs,
            "cache_hits": cache_hits,
            "cache_hit_rate": round(hit_rate, 4),
            "total_cost_usd": round(total_cost, 2),
            "total_savings_usd": round(total_savings, 2),
            "routing_savings_usd": round(routing_savings, 2),
            "cache_savings_usd": round(cache_savings, 2),
            "input_tokens": total_in,
            "output_tokens": total_out,
            "token_reduction_pct": round(reduction, 4),
        },
        "by_day": series,
        "by_model": by_model_list,
    }


@api.get("/forecast/predict")
async def forecast_predict(org_id: str = DEFAULT_ORG) -> dict:
    usage = await db.token_usage.find({"org_id": org_id}, {"_id": 0}).to_list(200000)
    by_day: dict[str, float] = {}
    for u in usage:
        d = u["timestamp"][:10]
        by_day[d] = by_day.get(d, 0.0) + u["cost_usd"]
    days = sorted(by_day.keys())
    if not days:
        return {"forecast": [], "current_run_rate_usd_per_day": 0}
    last7 = days[-7:]
    avg = sum(by_day[d] for d in last7) / len(last7)
    # growth trend across the 30 days
    n = len(days)
    half = max(1, n // 2)
    early = sum(by_day[d] for d in days[:half]) / half
    late = sum(by_day[d] for d in days[half:]) / max(1, n - half)
    growth = (late / early) ** (1 / max(1, n - half)) if early > 0 else 1.0

    today = datetime.now(timezone.utc).date()
    forecast = []
    val = avg
    for i in range(1, 91):
        val *= growth
        ci = val * 0.18
        forecast.append({
            "date": (today + timedelta(days=i)).isoformat(),
            "predicted_usd": round(val, 4),
            "ci_low": round(val - ci, 4),
            "ci_high": round(val + ci, 4),
        })
    return {
        "current_run_rate_usd_per_day": round(avg, 4),
        "growth_factor_daily": round(growth, 4),
        "forecast_30d_total_usd": round(sum(f["predicted_usd"] for f in forecast[:30]), 2),
        "forecast_60d_total_usd": round(sum(f["predicted_usd"] for f in forecast[:60]), 2),
        "forecast_90d_total_usd": round(sum(f["predicted_usd"] for f in forecast[:90]), 2),
        "forecast": forecast,
    }


@api.get("/advisor/recommend")
async def advisor_recommend(org_id: str = DEFAULT_ORG) -> list:
    recs = await db.recommendations.find({"org_id": org_id}, {"_id": 0}).to_list(100)
    return recs


@api.post("/advisor/recommend/{rec_id}/action")
async def advisor_action(rec_id: str, action: str) -> dict:
    if action not in ("accept", "dismiss"):
        raise HTTPException(400, "action must be 'accept' or 'dismiss'")
    status = "accepted" if action == "accept" else "dismissed"
    await db.recommendations.update_one({"id": rec_id}, {"$set": {"status": status}})
    return {"id": rec_id, "status": status}


@api.get("/budgets/status")
async def budgets_status(org_id: str = DEFAULT_ORG) -> dict:
    policies = await db.budget_policies.find({}, {"_id": 0}).to_list(100)
    teams = {t["id"]: t for t in await db.teams.find({"org_id": org_id}, {"_id": 0}).to_list(100)}
    users = {u["id"]: u for u in await db.users.find({"org_id": org_id}, {"_id": 0}).to_list(100)}
    enriched = []
    for p in policies:
        name = p["scope_id"]
        if p["scope"] == "team" and p["scope_id"] in teams:
            name = teams[p["scope_id"]]["name"]
        elif p["scope"] == "user" and p["scope_id"] in users:
            name = users[p["scope_id"]]["email"]
        elif p["scope"] == "org":
            name = "Acme Corp"
        used = p.get("used_usd", 0)
        limit = p.get("monthly_limit_usd", 0)
        pct = (used / limit) if limit else 0
        status = "healthy"
        if pct >= 1:
            status = "blocked"
        elif pct >= p.get("soft_pct", 0.8):
            status = "soft_limit"
        elif pct >= 0.5:
            status = "warning"
        enriched.append({**p, "name": name, "burn_pct": round(pct, 4), "status": status})
    return {"policies": enriched}


@api.get("/actions/history")
async def actions_history(org_id: str = DEFAULT_ORG) -> list:
    actions = await db.autonomous_actions.find({"org_id": org_id}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return actions


@api.get("/providers/health")
async def providers_health() -> dict:
    providers = await db.providers.find({}, {"_id": 0}).to_list(50)
    models = await db.models.find({}, {"_id": 0}).to_list(100)
    return {"providers": providers, "models": models}


@api.get("/optimization/log")
async def optimization_log(org_id: str = DEFAULT_ORG, limit: int = 100) -> list:
    return await db.optimization_actions.find({"org_id": org_id}, {"_id": 0}).sort("timestamp", -1).to_list(limit)


@api.get("/routing/decisions")
async def routing_decisions_list(org_id: str = DEFAULT_ORG, limit: int = 200) -> list:
    return await db.routing_decisions.find({"org_id": org_id}, {"_id": 0}).sort("timestamp", -1).to_list(limit)


@api.get("/cache/entries")
async def cache_entries_list(org_id: str = DEFAULT_ORG, limit: int = 100) -> list:
    entries = await db.cache_entries.find({"org_id": org_id}, {"_id": 0, "embedding": 0}).sort("hit_count", -1).to_list(limit)
    return entries


# ─── TIPE Analyzer ─────────────────────────────────────────────────────────
# Token & cost prediction across the full provider catalog for a given prompt.
EXPECTED_OUTPUT_RATIO = {
    "rca_summary":      2.5,   # short structured output
    "summarization":    0.6,
    "classification":   0.08,
    "extraction":       0.4,
    "code_generation":  4.0,
    "qa":               1.8,
    "general":          1.5,
}


class TipeRequest(BaseModel):
    prompt: str
    task_type: str = "general"
    baseline_model: str = "gpt-4o-mini"
    monthly_volume: int = 2400


@api.post("/tipe/analyze")
async def tipe_analyze(req: TipeRequest) -> dict:
    in_tokens = estimate_tokens(req.prompt)
    ratio = EXPECTED_OUTPUT_RATIO.get(req.task_type, 1.5)
    out_tokens = max(8, int(in_tokens * ratio))
    baseline = next((m for m in PROVIDER_CATALOG if m["model"] == req.baseline_model), PROVIDER_CATALOG[1])
    baseline_per_call = estimate_cost(in_tokens, out_tokens, baseline)
    rows = []
    for m in PROVIDER_CATALOG:
        per_call = estimate_cost(in_tokens, out_tokens, m)
        monthly = per_call * req.monthly_volume
        rows.append({
            "provider": m["provider"],
            "model": m["model"],
            "tier": m["tier"],
            "quality": m["quality"],
            "p95_latency_ms": m["p95"],
            "cost_per_call": round(per_call, 6),
            "monthly_cost": round(monthly, 4),
            "configurable": m.get("configurable", False),
        })
    rows.sort(key=lambda r: r["cost_per_call"])
    # Recommend cheapest that keeps quality within 0.05 of baseline
    candidates = [r for r in rows if r["quality"] >= baseline["quality"] - 0.05 and r["cost_per_call"] < baseline_per_call]
    recommended = candidates[0] if candidates else rows[0]
    savings_per_call = max(0.0, baseline_per_call - recommended["cost_per_call"])
    return {
        "input_tokens": in_tokens,
        "predicted_output_tokens": out_tokens,
        "task_type": req.task_type,
        "monthly_volume": req.monthly_volume,
        "baseline": {"provider": baseline["provider"], "model": baseline["model"],
                     "cost_per_call": round(baseline_per_call, 6),
                     "monthly_cost": round(baseline_per_call * req.monthly_volume, 4)},
        "recommended": recommended,
        "savings_per_call": round(savings_per_call, 6),
        "monthly_savings": round(savings_per_call * req.monthly_volume, 4),
        "savings_pct": round((savings_per_call / baseline_per_call) if baseline_per_call > 0 else 0, 4),
        "rows": rows,
    }


# ─── Migration Simulation ──────────────────────────────────────────────────
class MigrationRequest(BaseModel):
    from_model: str
    to_model: str
    monthly_volume: int = 10000
    avg_input_tokens: int = 400
    avg_output_tokens: int = 250


@api.post("/advisor/migration")
async def advisor_migration(req: MigrationRequest) -> dict:
    src = next((m for m in PROVIDER_CATALOG if m["model"] == req.from_model), None)
    dst = next((m for m in PROVIDER_CATALOG if m["model"] == req.to_model), None)
    if not src or not dst:
        raise HTTPException(404, "Unknown model")
    src_cpc = estimate_cost(req.avg_input_tokens, req.avg_output_tokens, src)
    dst_cpc = estimate_cost(req.avg_input_tokens, req.avg_output_tokens, dst)
    cost_delta = dst_cpc - src_cpc
    pct = (cost_delta / src_cpc) if src_cpc > 0 else 0
    quality_delta = dst["quality"] - src["quality"]
    latency_delta = dst["p95"] - src["p95"]
    monthly_src = src_cpc * req.monthly_volume
    monthly_dst = dst_cpc * req.monthly_volume
    verdict = "improvement" if (cost_delta < 0 and quality_delta >= -0.03) else (
        "trade-off" if cost_delta < 0 else "regression"
    )
    return {
        "from": {"provider": src["provider"], "model": src["model"],
                 "cost_per_call": round(src_cpc, 6), "monthly": round(monthly_src, 2),
                 "quality": src["quality"], "p95_ms": src["p95"]},
        "to": {"provider": dst["provider"], "model": dst["model"],
               "cost_per_call": round(dst_cpc, 6), "monthly": round(monthly_dst, 2),
               "quality": dst["quality"], "p95_ms": dst["p95"]},
        "cost_delta_per_call": round(cost_delta, 6),
        "cost_delta_pct": round(pct, 4),
        "monthly_savings": round(monthly_src - monthly_dst, 2),
        "quality_delta": round(quality_delta, 4),
        "latency_delta_ms": latency_delta,
        "verdict": verdict,
        "summary": (
            f"Switching {src['model']} → {dst['model']} for {req.monthly_volume:,}/mo "
            f"changes cost by {pct*100:+.1f}% "
            f"(${monthly_src - monthly_dst:+,.2f}/mo), quality by {quality_delta*100:+.1f} points, "
            f"P95 latency by {latency_delta:+d}ms. Verdict: {verdict}."
        ),
    }


# ─── AI Model Advisor (best-model picker) ──────────────────────────────────
class AdvisorRequest(BaseModel):
    objective: str = "balanced"        # balanced | cost | quality | latency
    primary_task: str = "general"      # maps to TASK_TYPES + extras
    monthly_budget_usd: float = 500
    monthly_volume: int = 10000
    avg_input_tokens: int = 400
    avg_output_tokens: int = 250


@api.post("/advisor/best-model")
async def advisor_best_model(req: AdvisorRequest) -> dict:
    candidates = []
    for m in PROVIDER_CATALOG:
        cpc = estimate_cost(req.avg_input_tokens, req.avg_output_tokens, m)
        monthly = cpc * req.monthly_volume
        affordable = monthly <= req.monthly_budget_usd
        if req.objective == "cost":
            score = -cpc * 1000
        elif req.objective == "quality":
            score = m["quality"] * 10 - cpc * 100
        elif req.objective == "latency":
            score = -m["p95"] / 100 + m["quality"]
        else:  # balanced
            score = m["quality"] * 5 - cpc * 200 - m["p95"] / 1000
        candidates.append({
            "provider": m["provider"], "model": m["model"], "tier": m["tier"],
            "quality": m["quality"], "p95_ms": m["p95"],
            "cost_per_call": round(cpc, 6), "monthly_cost": round(monthly, 2),
            "affordable": affordable, "score": round(score, 4),
            "configurable": m.get("configurable", False),
        })
    candidates.sort(key=lambda c: (-c["affordable"], -c["score"]))
    top = candidates[0]
    reasoning_parts = [
        f"Objective '{req.objective}' on task '{req.primary_task}'.",
        f"Budget ${req.monthly_budget_usd}/mo at {req.monthly_volume:,} calls/mo.",
        f"Recommended {top['provider']}/{top['model']} — quality {top['quality']}, ${top['cost_per_call']:.5f}/call, ${top['monthly_cost']:.2f}/mo.",
    ]
    return {
        "recommended": top,
        "alternates": candidates[1:6],
        "reasoning": " ".join(reasoning_parts),
        "all": candidates,
    }


# ─── Streaming Gateway (chunked SSE) ───────────────────────────────────────
from fastapi.responses import StreamingResponse
import asyncio
import json as jsonlib


@api.post("/gateway/stream")
async def gateway_stream(req: ChatRequest):
    """SSE endpoint — emits the final LLM response as token-like chunks plus a final event with cost/decision."""
    result = await gateway_chat(req)

    async def event_gen():
        # Emit metadata first
        meta = {k: v for k, v in result.items() if k != "response"}
        yield f"event: meta\ndata: {jsonlib.dumps(meta)}\n\n"
        # Stream the response in chunks
        text = result.get("response") or ""
        chunk_size = 24
        for i in range(0, len(text), chunk_size):
            chunk = text[i:i + chunk_size]
            yield f"event: token\ndata: {jsonlib.dumps({'text': chunk})}\n\n"
            await asyncio.sleep(0.04)
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@api.get("/")
async def root():
    return {"service": "right-llm", "version": "0.2.0"}


@api.get("/orgs")
async def list_orgs() -> list:
    return await db.organizations.find({}, {"_id": 0}).to_list(50)


@api.get("/health")
async def health():
    return {"ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup() -> None:
    # Auto-seed if empty
    count = await db.requests.count_documents({})
    if count == 0:
        logger.info("Empty DB — running auto-seed")
        import seed
        await seed.seed()


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()
