"""Routing routes — /routing/decision (synchronous what-would-route) + /routing/decisions log."""
from fastapi import APIRouter

from db import db, DEFAULT_ORG
from engines import route
from models import RoutingRequest

router = APIRouter(tags=["routing"])


@router.post("/routing/decision")
async def routing_decision(req: RoutingRequest) -> dict:
    d = route(req.prompt, quality_floor=req.quality_floor, budget_remaining_pct=req.budget_remaining_pct)
    return {
        "task": d["task"],
        "complexity": d.get("selected_complexity", d["complexity"]),
        "downgraded_due_to_budget": d.get("downgraded_due_to_budget", False),
        "model": d["model"]["model"],
        "provider": d["model"]["provider"],
        "reasoning": d["reasoning"],
        "model_details": d["model"],
    }


@router.get("/routing/decisions")
async def routing_decisions_list(org_id: str = DEFAULT_ORG, limit: int = 200) -> list:
    return await db.routing_decisions.find({"org_id": org_id}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
