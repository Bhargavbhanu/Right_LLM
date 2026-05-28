"""Gateway routes — /gateway/chat (single-shot) + /gateway/stream (SSE)."""
import asyncio
import json as jsonlib
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import StreamingResponse

from db import db
from engines import (
    PROVIDER_CATALOG, cosine, embed, embed_async, estimate_cost,
    estimate_tokens, optimize_prompt, prune_messages, route,
)
from models import ChatRequest
from services.llm import call_llm

router = APIRouter(tags=["gateway"])


def _decision_summary(d: dict) -> dict:
    return {
        "task": d["task"],
        "complexity": d.get("selected_complexity", d["complexity"]),
        "downgraded_due_to_budget": d.get("downgraded_due_to_budget", False),
        "model": d["model"]["model"],
        "provider": d["model"]["provider"],
        "reasoning": d["reasoning"],
    }


async def _chat_impl(req: ChatRequest) -> dict[str, Any]:
    started = time.time()
    user_msgs = [m for m in req.messages if m.role == "user"]
    if not user_msgs:
        raise HTTPException(400, "No user message provided")
    raw_prompt = user_msgs[-1].content

    opt = optimize_prompt(raw_prompt)
    pruned_messages = prune_messages([m.model_dump() for m in req.messages])
    if pruned_messages and pruned_messages[-1]["role"] == "user":
        pruned_messages[-1] = {**pruned_messages[-1], "content": opt["compressed"]}

    # Cache lookup — async embed (prefers OpenAI when OPENAI_API_KEY set)
    cache_hit = None
    vec = await embed_async(opt["compressed"])
    if req.use_cache:
        exact = await db.cache_entries.find_one(
            {"org_id": req.org_id, "prompt": opt["compressed"]}, {"_id": 0}
        )
        if exact:
            cache_hit = {"layer": "L1", "similarity": 1.0, "entry": exact}
        else:
            cursor = db.cache_entries.find({"org_id": req.org_id}, {"_id": 0}).limit(500)
            best, best_sim = None, 0.0
            async for entry in cursor:
                ev = entry.get("embedding")
                if not ev or len(ev) != len(vec):
                    ev = embed(entry["prompt"])
                    if len(ev) != len(vec):
                        continue
                sim = cosine(vec, ev)
                if sim > best_sim:
                    best_sim, best = sim, entry
            if best and best_sim >= req.similarity_threshold:
                cache_hit = {"layer": "L2", "similarity": round(best_sim, 4), "entry": best}

    # Budget lookup
    org_budget = await db.budget_policies.find_one({"scope": "org", "scope_id": req.org_id}, {"_id": 0})
    remaining_pct = 1.0
    if org_budget and org_budget.get("monthly_limit_usd"):
        remaining_pct = max(0.0, 1.0 - org_budget["used_usd"] / org_budget["monthly_limit_usd"])

    # Routing
    decision = route(opt["compressed"], quality_floor=req.quality_floor, budget_remaining_pct=remaining_pct)
    model = decision["model"]
    if req.model:
        forced = next((m for m in PROVIDER_CATALOG if m["model"] == req.model), None)
        if forced:
            model = forced
            decision["model"] = model
            decision["reasoning"] += f" (user override → {model['model']})"

    # Cache return path
    if cache_hit:
        latency_ms = int((time.time() - started) * 1000)
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
            "cost_usd": 0.0,
            "latency_ms": latency_ms,
            "optimization": opt,
            "decision": _decision_summary(decision),
        }

    # Real LLM
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

    # Persist
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
        "id": req_id, "response": response_text, "cache_hit": False,
        "model": model["model"], "provider": model["provider"],
        "cost_usd": round(cost_usd, 6), "baseline_cost_usd": round(baseline_cost, 6),
        "savings_usd": round(savings, 6), "latency_ms": total_latency,
        "provider_latency_ms": provider_latency,
        "optimization": opt, "decision": _decision_summary(decision),
        "status": status, "error": error,
    }


def register_gateway(api_router: APIRouter, limiter) -> None:
    """Attach gateway endpoints to the API router with rate-limit decorators.

    The rate-limiter must be applied at registration time because slowapi wraps the
    function via decorator. This keeps the route logic itself decoupled from limiter
    configuration.
    """

    @api_router.post("/gateway/chat")
    @limiter.limit("60/minute")
    async def gateway_chat(request: Request, req: ChatRequest = Body(...)) -> dict[str, Any]:
        return await _chat_impl(req)

    @api_router.post("/gateway/stream")
    @limiter.limit("60/minute")
    async def gateway_stream(request: Request, req: ChatRequest = Body(...)):
        result = await _chat_impl(req)

        async def event_gen():
            meta = {k: v for k, v in result.items() if k != "response"}
            yield f"event: meta\ndata: {jsonlib.dumps(meta)}\n\n"
            text = result.get("response") or ""
            chunk_size = 24
            for i in range(0, len(text), chunk_size):
                yield f"event: token\ndata: {jsonlib.dumps({'text': text[i:i + chunk_size]})}\n\n"
                await asyncio.sleep(0.04)
            yield "event: done\ndata: {}\n\n"

        return StreamingResponse(event_gen(), media_type="text/event-stream")
