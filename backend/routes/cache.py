"""Cache routes — /cache/search + /cache/entries list."""
from fastapi import APIRouter

from db import db, DEFAULT_ORG
from engines import cosine, embed, embed_async
from models import CacheSearchRequest

router = APIRouter(tags=["cache"])


@router.post("/cache/search")
async def cache_search(req: CacheSearchRequest) -> dict:
    vec = await embed_async(req.prompt)
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
    return {
        "hit": bool(best and best_sim >= req.similarity_threshold),
        "similarity": round(best_sim, 4),
        "threshold": req.similarity_threshold,
        "entry": best,
    }


@router.get("/cache/entries")
async def cache_entries_list(org_id: str = DEFAULT_ORG, limit: int = 100) -> list:
    return await db.cache_entries.find(
        {"org_id": org_id}, {"_id": 0, "embedding": 0}
    ).sort("hit_count", -1).to_list(limit)
