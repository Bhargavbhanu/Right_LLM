"""Analytics + forecasting routes."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from db import db, DEFAULT_ORG

router = APIRouter(tags=["analytics"])


@router.get("/analytics/usage")
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


@router.get("/forecast/predict")
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
