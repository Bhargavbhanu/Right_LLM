"""Autonomous-action history endpoint."""
from fastapi import APIRouter

from db import db, DEFAULT_ORG

router = APIRouter(tags=["actions"])


@router.get("/actions/history")
async def actions_history(org_id: str = DEFAULT_ORG) -> list:
    return await db.autonomous_actions.find({"org_id": org_id}, {"_id": 0}).sort("timestamp", -1).to_list(200)
