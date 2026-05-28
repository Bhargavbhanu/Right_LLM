"""Provider API-key store.

Stores configurable-provider credentials (Groq, Ollama, Bedrock, Azure) encrypted in
Mongo so admin users can paste keys via the Settings UI. The engines.py routing layer
reads from this store (with fall-back to environment variables) when deciding whether
a configurable provider is "live" and routable.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = ["groq", "ollama", "bedrock", "azure"]

# Map provider → list of credential keys the user can paste
PROVIDER_KEY_SCHEMA: dict[str, list[dict]] = {
    "groq":    [{"key": "GROQ_API_KEY",         "label": "API Key",     "hint": "gsk_…"}],
    "ollama":  [{"key": "OLLAMA_BASE_URL",      "label": "Base URL",    "hint": "http://localhost:11434"}],
    "bedrock": [
        {"key": "AWS_ACCESS_KEY_ID",            "label": "Access Key",  "hint": "AKIA…"},
        {"key": "AWS_SECRET_ACCESS_KEY",        "label": "Secret Key",  "hint": "•••"},
        {"key": "AWS_REGION",                   "label": "Region",      "hint": "us-east-1"},
    ],
    "azure":   [
        {"key": "AZURE_OPENAI_API_KEY",         "label": "API Key",     "hint": "•••"},
        {"key": "AZURE_OPENAI_ENDPOINT",        "label": "Endpoint",    "hint": "https://your-resource.openai.azure.com"},
    ],
}

_ALL_KEYS = {k["key"] for slots in PROVIDER_KEY_SCHEMA.values() for k in slots}

_settings_router = APIRouter(prefix="/settings", tags=["settings"])


def _fernet() -> Fernet:
    return Fernet(os.environ["PROVIDER_KEY_ENC_KEY"].encode("utf-8"))


def _encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def _decrypt(cipher: str) -> Optional[str]:
    try:
        return _fernet().decrypt(cipher.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


def _mask(plain: str) -> str:
    if not plain:
        return ""
    if len(plain) <= 8:
        return "•" * len(plain)
    return f"{plain[:4]}…{plain[-4:]}"


# ── Data model ─────────────────────────────────────────────────────────────
class ProviderKeyUpdate(BaseModel):
    provider: str
    values: dict  # {key_name: plain_text_value | ""}


# ── Public helpers (used by engines.py at request time) ────────────────────
_cache: dict[str, str] = {}
_cache_loaded = False


async def load_keys_from_db(db) -> None:
    """Populate the in-process cache from Mongo. Called on startup + after updates."""
    global _cache, _cache_loaded
    docs = await db.provider_keys.find({}, {"_id": 0}).to_list(64)
    cache: dict[str, str] = {}
    for doc in docs:
        for k, v in (doc.get("values") or {}).items():
            if k in _ALL_KEYS and v:
                plain = _decrypt(v)
                if plain:
                    cache[k] = plain
    _cache = cache
    _cache_loaded = True


def get_credential(key_name: str) -> Optional[str]:
    """Resolve a credential — DB first, env second. Used by engines.py."""
    val = _cache.get(key_name)
    if val:
        return val
    return os.environ.get(key_name)


def provider_is_configured(provider: str) -> bool:
    """A provider is live if ALL its required keys are present (DB or env)."""
    slots = PROVIDER_KEY_SCHEMA.get(provider, [])
    if not slots:
        return False
    return all(get_credential(s["key"]) for s in slots)


# ── Router builder ─────────────────────────────────────────────────────────
def build_settings_router(db, require_admin):
    """Build the settings router with admin-only mutation."""

    @_settings_router.get("/providers")
    async def list_provider_settings(user: dict = Depends(require_admin)):
        out = []
        for provider in SUPPORTED_PROVIDERS:
            slots = PROVIDER_KEY_SCHEMA[provider]
            doc = await db.provider_keys.find_one({"provider": provider}, {"_id": 0}) or {}
            stored = doc.get("values") or {}
            field_state = []
            for slot in slots:
                cipher = stored.get(slot["key"])
                plain = _decrypt(cipher) if cipher else None
                env_val = os.environ.get(slot["key"])
                resolved = plain or env_val
                field_state.append({
                    "key": slot["key"],
                    "label": slot["label"],
                    "hint": slot["hint"],
                    "has_value": bool(resolved),
                    "source": "db" if plain else ("env" if env_val else None),
                    "masked": _mask(resolved or ""),
                })
            out.append({
                "provider": provider,
                "fields": field_state,
                "configured": provider_is_configured(provider),
                "updated_at": doc.get("updated_at"),
            })
        return {"providers": out}

    @_settings_router.put("/providers")
    async def update_provider_settings(
        body: ProviderKeyUpdate, user: dict = Depends(require_admin)
    ):
        if body.provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(status_code=400, detail="Unsupported provider")
        schema_keys = {s["key"] for s in PROVIDER_KEY_SCHEMA[body.provider]}
        encrypted: dict[str, str] = {}
        for k, v in body.values.items():
            if k not in schema_keys:
                raise HTTPException(status_code=400, detail=f"Unknown field: {k}")
            v = (v or "").strip()
            if v:  # only encrypt non-empty values; empty string clears the field
                encrypted[k] = _encrypt(v)
        await db.provider_keys.update_one(
            {"provider": body.provider},
            {"$set": {
                "provider": body.provider,
                "values": encrypted,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": user["email"],
            }},
            upsert=True,
        )
        await load_keys_from_db(db)
        return {"ok": True, "configured": provider_is_configured(body.provider)}

    @_settings_router.delete("/providers/{provider}")
    async def clear_provider_settings(provider: str, user: dict = Depends(require_admin)):
        if provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(status_code=400, detail="Unsupported provider")
        await db.provider_keys.delete_one({"provider": provider})
        await load_keys_from_db(db)
        return {"ok": True}

    return _settings_router
