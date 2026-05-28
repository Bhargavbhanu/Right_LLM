"""Advisor + TIPE + Migration routes."""
from fastapi import APIRouter, HTTPException

from db import db, DEFAULT_ORG
from engines import PROVIDER_CATALOG, estimate_cost, estimate_tokens
from models import AdvisorRequest, MigrationRequest, TipeRequest

router = APIRouter(tags=["advisor"])


EXPECTED_OUTPUT_RATIO = {
    "rca_summary":      2.5,
    "summarization":    0.6,
    "classification":   0.08,
    "extraction":       0.4,
    "code_generation":  4.0,
    "qa":               1.8,
    "general":          1.5,
}


# ── Recommendation advisor (accept/dismiss flow) ─────────────────────────
@router.get("/advisor/recommend")
async def advisor_recommend(org_id: str = DEFAULT_ORG) -> list:
    return await db.recommendations.find({"org_id": org_id}, {"_id": 0}).to_list(100)


@router.post("/advisor/recommend/{rec_id}/action")
async def advisor_action(rec_id: str, action: str) -> dict:
    if action not in ("accept", "dismiss"):
        raise HTTPException(400, "action must be 'accept' or 'dismiss'")
    status = "accepted" if action == "accept" else "dismissed"
    await db.recommendations.update_one({"id": rec_id}, {"$set": {"status": status}})
    return {"id": rec_id, "status": status}


# ── TIPE analyzer ──────────────────────────────────────────────────────────
@router.post("/tipe/analyze")
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
            "provider": m["provider"], "model": m["model"], "tier": m["tier"],
            "quality": m["quality"], "p95_latency_ms": m["p95"],
            "cost_per_call": round(per_call, 6),
            "monthly_cost": round(monthly, 4),
            "configurable": m.get("configurable", False),
        })
    rows.sort(key=lambda r: r["cost_per_call"])
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


# ── Migration simulator ────────────────────────────────────────────────────
@router.post("/advisor/migration")
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


# ── Best-model picker ──────────────────────────────────────────────────────
@router.post("/advisor/best-model")
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
        else:
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
    reasoning = (
        f"Objective '{req.objective}' on task '{req.primary_task}'. "
        f"Budget ${req.monthly_budget_usd}/mo at {req.monthly_volume:,} calls/mo. "
        f"Recommended {top['provider']}/{top['model']} — quality {top['quality']}, "
        f"${top['cost_per_call']:.5f}/call, ${top['monthly_cost']:.2f}/mo."
    )
    return {
        "recommended": top,
        "alternates": candidates[1:6],
        "reasoning": reasoning,
        "all": candidates,
    }
