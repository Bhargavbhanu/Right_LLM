"""Provider health + catalog."""
from fastapi import APIRouter

from db import db

router = APIRouter(tags=["providers"])


@router.get("/providers/health")
async def providers_health() -> dict:
    providers = await db.providers.find({}, {"_id": 0}).to_list(50)
    models = await db.models.find({}, {"_id": 0}).to_list(100)
    return {"providers": providers, "models": models}
