"""Optimization-log endpoint."""
from fastapi import APIRouter

from db import db, DEFAULT_ORG

router = APIRouter(tags=["optimization"])


@router.get("/optimization/log")
async def optimization_log(org_id: str = DEFAULT_ORG, limit: int = 100) -> list:
    return await db.optimization_actions.find({"org_id": org_id}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
