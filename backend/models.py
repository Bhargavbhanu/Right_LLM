"""All Pydantic request models for the gateway + advisor + cache endpoints."""
from typing import Optional

from pydantic import BaseModel

from db import DEFAULT_ORG


# ── Chat / Gateway ─────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: Optional[str] = None
    quality_floor: float = 0.78
    use_cache: bool = True
    similarity_threshold: float = 0.92
    org_id: str = DEFAULT_ORG
    user_id: str = "u_admin"
    team_id: str = "t_eng"


# ── Routing ────────────────────────────────────────────────────────────────
class RoutingRequest(BaseModel):
    prompt: str
    quality_floor: float = 0.78
    budget_remaining_pct: float = 1.0


# ── Cache ──────────────────────────────────────────────────────────────────
class CacheSearchRequest(BaseModel):
    prompt: str
    similarity_threshold: float = 0.92
    org_id: str = DEFAULT_ORG


# ── TIPE Analyzer ──────────────────────────────────────────────────────────
class TipeRequest(BaseModel):
    prompt: str
    task_type: str = "general"
    baseline_model: str = "gpt-4o-mini"
    monthly_volume: int = 2400


# ── Migration Simulation ───────────────────────────────────────────────────
class MigrationRequest(BaseModel):
    from_model: str
    to_model: str
    monthly_volume: int = 10000
    avg_input_tokens: int = 400
    avg_output_tokens: int = 250


# ── AI Model Advisor (best-model picker) ───────────────────────────────────
class AdvisorRequest(BaseModel):
    objective: str = "balanced"        # balanced | cost | quality | latency
    primary_task: str = "general"
    monthly_budget_usd: float = 500
    monthly_volume: int = 10000
    avg_input_tokens: int = 400
    avg_output_tokens: int = 250
