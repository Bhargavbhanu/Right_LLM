"""Budget routes — /budgets/status."""
from fastapi import APIRouter

from db import db, DEFAULT_ORG

router = APIRouter(tags=["budgets"])


@router.get("/budgets/status")
async def budgets_status(org_id: str = DEFAULT_ORG) -> dict:
    policies = await db.budget_policies.find({}, {"_id": 0}).to_list(100)
    teams = {t["id"]: t for t in await db.teams.find({"org_id": org_id}, {"_id": 0}).to_list(100)}
    users = {u["id"]: u for u in await db.users.find({"org_id": org_id}, {"_id": 0}).to_list(100) if "id" in u}
    enriched = []
    for p in policies:
        name = p["scope_id"]
        if p["scope"] == "team" and p["scope_id"] in teams:
            name = teams[p["scope_id"]]["name"]
        elif p["scope"] == "user" and p["scope_id"] in users:
            name = users[p["scope_id"]]["email"]
        elif p["scope"] == "org":
            org_name_map = {"org_acme": "CloudScore", "org_globex": "MutexCorp", "org_initech": "ExcelHire"}
            name = org_name_map.get(p["scope_id"], p["scope_id"])
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
