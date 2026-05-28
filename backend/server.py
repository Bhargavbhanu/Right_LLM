"""Right LLM — slim FastAPI entrypoint.

Mounts feature routers from `routes/`, auth + settings, configures CORS + rate limit +
structured logging, and bootstraps the database (auto-seed, admin upsert, provider-key
cache warm-up).
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.cors import CORSMiddleware

# ── env first so downstream modules can read it ────────────────────────────
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import auth as auth_mod  # noqa: E402  needs env first
import provider_keys  # noqa: E402
from db import db, client  # noqa: E402
from routes import ALL_ROUTERS  # noqa: E402
from routes.gateway import register_gateway  # noqa: E402
from services.logging_mw import RequestIdMiddleware, configure_logging  # noqa: E402

logger = configure_logging()


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="Right LLM Gateway", version="0.3.0")
api = APIRouter(prefix="/api")


# ── Rate limiter ───────────────────────────────────────────────────────────
def _rate_key(request: Request) -> str:
    org = request.headers.get("X-Org-Id")
    return org or get_remote_address(request)


limiter = Limiter(key_func=_rate_key)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Auth deps (db-bound) ───────────────────────────────────────────────────
get_current_user = auth_mod.get_current_user_factory(lambda: db)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


# ── Mount feature routers ──────────────────────────────────────────────────
register_gateway(api, limiter)  # gateway needs the limiter at registration time
for r in ALL_ROUTERS:
    # Skip duplicate gateway router — it was already attached via register_gateway
    if r.tags and "gateway" in r.tags:
        continue
    api.include_router(r)

app.include_router(api)
app.include_router(auth_mod.build_auth_router(db, get_current_user), prefix="/api")
app.include_router(provider_keys.build_settings_router(db, require_admin), prefix="/api")


# ── Middleware ─────────────────────────────────────────────────────────────
app.add_middleware(RequestIdMiddleware, logger=logger)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Lifecycle ──────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup() -> None:
    count = await db.requests.count_documents({})
    if count == 0:
        logger.info("Empty DB — running auto-seed")
        import seed  # noqa: WPS433
        await seed.seed()
    await auth_mod.seed_users(db)
    await provider_keys.load_keys_from_db(db)
    logger.info("Boot OK — %d routers mounted", len(ALL_ROUTERS) + 2)


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()
