"""Meta endpoints — root banner, orgs list, health."""
from fastapi import APIRouter

from db import db

router = APIRouter(tags=["meta"])


@router.get("/")
async def root() -> dict:
    return {"service": "right-llm", "version": "0.3.0"}


@router.get("/orgs")
async def list_orgs() -> list:
    return await db.organizations.find({}, {"_id": 0}).to_list(50)


@router.get("/health")
async def health() -> dict:
    return {"ok": True}
