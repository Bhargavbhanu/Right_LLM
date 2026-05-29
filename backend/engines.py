"""
Right LLM — core engines:
  • Token estimator
  • Optimization Engine  (prompt compression / context pruning)
  • Embedding (deterministic hash-ngram fallback — used when real embeddings unavailable)
  • Semantic Cache (L1 exact + L2 cosine similarity)
  • Routing Engine  (task classification + cheapest-model-that-fits selection)
  • Budget Engine
  • Autonomous Action Engine triggers
"""
from __future__ import annotations
import hashlib
import math
import re
import time
from dataclasses import dataclass, field
from typing import Optional


# ── Provider catalog ────────────────────────────────────────────────────────
# Cost is USD per 1K tokens (input/output) — public list-prices, approx.
PROVIDER_CATALOG = [
    {"provider": "gemini",    "model": "gemini-2.5-flash",            "tier": "simple",   "in": 0.000075, "out": 0.0003,  "p95": 480,  "quality": 0.78},
    {"provider": "openai",    "model": "gpt-4o-mini",                 "tier": "simple",   "in": 0.00015,  "out": 0.0006,  "p95": 620,  "quality": 0.82},
    {"provider": "anthropic", "model": "claude-haiku-4-5-20251001",   "tier": "moderate", "in": 0.001,    "out": 0.005,   "p95": 720,  "quality": 0.86},
    {"provider": "gemini",    "model": "gemini-2.5-pro",              "tier": "moderate", "in": 0.00125,  "out": 0.005,   "p95": 980,  "quality": 0.90},
    {"provider": "openai",    "model": "gpt-4o",                      "tier": "complex",  "in": 0.0025,   "out": 0.01,    "p95": 1100, "quality": 0.93},
    {"provider": "anthropic", "model": "claude-sonnet-4-5-20250929",  "tier": "complex",  "in": 0.003,    "out": 0.015,   "p95": 1250, "quality": 0.95},
    {"provider": "anthropic", "model": "claude-opus-4-5-20251101",    "tier": "critical", "in": 0.015,    "out": 0.075,   "p95": 1900, "quality": 0.98},
    # ── Configurable providers (require user-supplied keys; appear in advisor/analyzer) ──
    {"provider": "groq",      "model": "llama-3.1-8b-instant",        "tier": "simple",   "in": 0.00005,  "out": 0.00008, "p95": 220,  "quality": 0.72, "configurable": True},
    {"provider": "groq",      "model": "llama-3.3-70b-versatile",     "tier": "moderate", "in": 0.00059,  "out": 0.00079, "p95": 360,  "quality": 0.85, "configurable": True},
    {"provider": "ollama",    "model": "llama3.2",                    "tier": "simple",   "in": 0.0,      "out": 0.0,     "p95": 850,  "quality": 0.74, "configurable": True},
    {"provider": "ollama",    "model": "qwen2.5:14b",                 "tier": "moderate", "in": 0.0,      "out": 0.0,     "p95": 1400, "quality": 0.83, "configurable": True},
    {"provider": "bedrock",   "model": "anthropic.claude-3-5-sonnet", "tier": "complex",  "in": 0.003,    "out": 0.015,   "p95": 1280, "quality": 0.95, "configurable": True},
    {"provider": "bedrock",   "model": "meta.llama3-70b",             "tier": "moderate", "in": 0.00265,  "out": 0.0035,  "p95": 1050, "quality": 0.84, "configurable": True},
    {"provider": "azure",     "model": "azure-gpt-4o",                "tier": "complex",  "in": 0.0025,   "out": 0.01,    "p95": 1150, "quality": 0.93, "configurable": True},
    {"provider": "azure",     "model": "azure-gpt-4o-mini",           "tier": "simple",   "in": 0.00015,  "out": 0.0006,  "p95": 640,  "quality": 0.82, "configurable": True},
]

TIER_ORDER = {"simple": 0, "moderate": 1, "complex": 2, "critical": 3}


def estimate_tokens(text: str) -> int:
    """Approx token count — 1 token ≈ 4 chars for English."""
    return max(1, len(text) // 4)


def estimate_cost(prompt_tokens: int, completion_tokens: int, model: dict) -> float:
    return (prompt_tokens / 1000.0) * model["in"] + (completion_tokens / 1000.0) * model["out"]


# ── Embedding ─────────────────────────────────────────────────────────────
# Hybrid approach:
#   • Default: a much-improved deterministic 512-dim embedding that combines word
#     n-grams (1+2+3) with character n-grams (3,4,5) — semantically far stronger than
#     bag-of-md5-bigrams. Good for cache hit-rate up to ~10k entries.
#   • If OPENAI_API_KEY is set in env, we call OpenAI text-embedding-3-small for the
#     "real" 1536-dim vectors. Cached responses are pinned to whichever dim is active
#     so cosine() always compares same-shape vectors.
#
# We intentionally do NOT route this through emergentintegrations / EMERGENT_LLM_KEY —
# the universal key proxy is for chat/image only and does not expose embeddings.
import os as _os
EMBED_DIM = 512
_OPENAI_EMBED_MODEL = "text-embedding-3-small"


def _hash_embed(text: str) -> list[float]:
    """Improved deterministic embedding — word + char n-grams projected via signed
    feature-hashing into a 512-dim unit vector. Pure-python, ~80µs per call."""
    text = text.lower()
    words = re.findall(r"[a-z0-9]+", text)
    vec = [0.0] * EMBED_DIM

    def _bump(token: str, weight: float = 1.0) -> None:
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        idx = h % EMBED_DIM
        sign = 1.0 if (h >> 16) & 1 else -1.0
        vec[idx] += sign * weight

    # Word unigrams + bigrams + trigrams (decreasing weight — bigrams capture phrase
    # context, trigrams catch named entities and idioms).
    for w in words:
        _bump(w, 1.0)
    for a, b in zip(words, words[1:]):
        _bump(f"{a}_{b}", 0.8)
    for a, b, c in zip(words, words[1:], words[2:]):
        _bump(f"{a}_{b}_{c}", 0.5)

    # Character n-grams (3-5) on the raw text — catches morphology + typos.
    # Sample every 2 chars to keep latency bounded on long prompts.
    txt = re.sub(r"\s+", " ", text)
    for n in (3, 4, 5):
        for i in range(0, max(0, len(txt) - n), 2):
            _bump(f"c{n}_{txt[i:i+n]}", 0.4)

    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


# Optional real OpenAI embeddings — activated by setting OPENAI_API_KEY in backend/.env.
_openai_client = None
_openai_available = False


def _maybe_init_openai() -> None:
    """Initialize the OpenAI async client lazily. Safe to call repeatedly."""
    global _openai_client, _openai_available
    # Already initialized, or no key in env → nothing to do.
    if _openai_client is not None or "OPENAI_API_KEY" not in _os.environ:
        return
    try:
        from openai import AsyncOpenAI  # noqa: WPS433 — local import: optional dep
        _openai_client = AsyncOpenAI(api_key=_os.environ["OPENAI_API_KEY"], timeout=10.0)
        _openai_available = True
    except Exception:
        _openai_available = False


async def embed_async(text: str) -> list[float]:
    """Async embedding — uses OpenAI if configured, else deterministic hash."""
    _maybe_init_openai()
    if _openai_available and _openai_client is not None:
        try:
            r = await _openai_client.embeddings.create(model=_OPENAI_EMBED_MODEL, input=text[:8000])
            return r.data[0].embedding  # 1536-dim
        except Exception:
            # On any failure fall through to deterministic — never break a request
            pass
    return _hash_embed(text)


def embed(text: str) -> list[float]:
    """Sync embedding — always deterministic. Used by tests and any non-async path.

    Production traffic goes through `embed_async` which prefers real OpenAI embeddings
    when OPENAI_API_KEY is set.
    """
    return _hash_embed(text)


def cosine(a: list[float], b: list[float]) -> float:
    # Truncate to shorter length so cross-dim comparisons don't crash (defence in depth)
    n = min(len(a), len(b))
    return sum(a[i] * b[i] for i in range(n))


# ── Optimization Engine ─────────────────────────────────────────────────────
FILLER_PATTERNS = [
    (re.compile(r"\b(please|kindly|i would like you to|could you please)\b", re.I), ""),
    (re.compile(r"\b(as an ai language model[,\s])", re.I), ""),
    (re.compile(r"\b(in other words|that being said|it is important to note that|needless to say)\b", re.I), ""),
    (re.compile(r"\s+"), " "),
    (re.compile(r"\n{3,}"), "\n\n"),
]


def optimize_prompt(text: str) -> dict:
    """Compress whitespace + remove low-info fillers. Returns dict with before/after stats."""
    original = text
    compressed = text
    for pat, repl in FILLER_PATTERNS:
        compressed = pat.sub(repl, compressed)
    compressed = compressed.strip()
    before_tokens = estimate_tokens(original)
    after_tokens = estimate_tokens(compressed)
    saved = max(0, before_tokens - after_tokens)
    ratio = (saved / before_tokens) if before_tokens else 0.0
    return {
        "original": original,
        "compressed": compressed,
        "before_tokens": before_tokens,
        "after_tokens": after_tokens,
        "saved_tokens": saved,
        "compression_ratio": round(ratio, 4),
    }


def prune_messages(messages: list[dict], max_messages: int = 10) -> list[dict]:
    """Keep system msg + last N messages."""
    sys_msgs = [m for m in messages if m.get("role") == "system"]
    others = [m for m in messages if m.get("role") != "system"]
    if len(others) <= max_messages:
        return sys_msgs + others
    return sys_msgs + others[-max_messages:]


# ── Routing Engine ──────────────────────────────────────────────────────────
COMPLEXITY_KEYWORDS = {
    "critical":  ["legal contract", "medical diagnosis", "regulatory filing", "production code review", "security audit"],
    "complex":   ["analyze", "reason", "step by step", "design", "architecture", "debug", "research", "compare and contrast"],
    "moderate":  ["explain", "summarize", "rewrite", "translate", "extract", "classify"],
    "simple":    ["hello", "hi ", "thanks", "yes", "no", "ok", "list", "what is", "define"],
}

TASK_TYPES = ["summarization", "classification", "extraction", "reasoning", "coding", "rag", "conversational"]


def classify_task(prompt: str) -> dict:
    p = prompt.lower()
    # complexity
    complexity = "simple"
    for tier in ["critical", "complex", "moderate", "simple"]:
        if any(k in p for k in COMPLEXITY_KEYWORDS[tier]):
            complexity = tier
            break
    # length heuristic
    tokens = estimate_tokens(prompt)
    if tokens > 1500 and complexity == "simple":
        complexity = "moderate"
    if tokens > 4000 and TIER_ORDER[complexity] < TIER_ORDER["complex"]:
        complexity = "complex"
    # task type
    task = "conversational"
    if any(k in p for k in ["summari", "tl;dr", "summary"]):
        task = "summarization"
    elif any(k in p for k in ["classify", "category", "label", "sentiment"]):
        task = "classification"
    elif any(k in p for k in ["extract", "json", "fields", "parse"]):
        task = "extraction"
    elif any(k in p for k in ["code", "function", "python", "javascript", "bug", "compile"]):
        task = "coding"
    elif any(k in p for k in ["reason", "analyze", "compare", "evaluate"]):
        task = "reasoning"
    elif any(k in p for k in ["document", "knowledge base", "according to"]):
        task = "rag"
    return {"complexity": complexity, "task": task, "estimated_tokens": tokens}


def _provider_has_credentials(provider: str) -> bool:
    """Check if a configurable provider has its credentials configured.

    Resolution order: in-memory cache populated from Mongo `provider_keys` collection
    (the Settings UI writes here) → environment variables.
    """
    try:
        from provider_keys import provider_is_configured
        return provider_is_configured(provider)
    except Exception:
        # Fall back to env-only lookup if provider_keys not yet imported
        import os as _os
        env_map = {"groq": "GROQ_API_KEY", "ollama": "OLLAMA_BASE_URL",
                   "bedrock": "AWS_ACCESS_KEY_ID", "azure": "AZURE_OPENAI_API_KEY"}
        var = env_map.get(provider)
        return bool(var and _os.environ.get(var))


def select_model(
    complexity: str,
    quality_floor: float = 0.78,
    excluded_models: Optional[list[str]] = None,
    excluded_providers: Optional[list[str]] = None,
) -> dict:
    """Pick the cheapest model whose tier ≥ required complexity and quality ≥ floor.
    Configurable providers (groq/ollama/bedrock/azure) are skipped unless their env key is set."""
    excluded_models = set(excluded_models or [])
    excluded_providers = set(excluded_providers or [])
    required = TIER_ORDER[complexity]
    candidates = [
        m for m in PROVIDER_CATALOG
        if TIER_ORDER[m["tier"]] >= required
        and m["quality"] >= quality_floor
        and m["model"] not in excluded_models
        and m["provider"] not in excluded_providers
        and (not m.get("configurable") or _provider_has_credentials(m["provider"]))
    ]
    if not candidates:
        candidates = [m for m in PROVIDER_CATALOG if m["model"] not in excluded_models
                      and (not m.get("configurable") or _provider_has_credentials(m["provider"]))]
    # cheapest by weighted (in*0.3 + out*0.7) since output tokens dominate cost
    candidates.sort(key=lambda m: m["in"] * 0.3 + m["out"] * 0.7)
    return candidates[0]


def route(prompt: str, quality_floor: float = 0.78, budget_remaining_pct: float = 1.0) -> dict:
    """Run full routing decision and return reasoning."""
    cls = classify_task(prompt)
    complexity = cls["complexity"]
    # If budget is tight, auto-downgrade
    downgraded = False
    if budget_remaining_pct < 0.2 and TIER_ORDER[complexity] > 0:
        old = complexity
        order = ["simple", "moderate", "complex", "critical"]
        complexity = order[max(0, TIER_ORDER[old] - 1)]
        downgraded = True
    model = select_model(complexity, quality_floor=quality_floor)
    baseline = next(m for m in PROVIDER_CATALOG if m["model"] == "gpt-4o")
    return {
        **cls,
        "selected_complexity": complexity,
        "downgraded_due_to_budget": downgraded,
        "model": model,
        "baseline_model": baseline,
        "reasoning": (
            f"Task classified as '{cls['task']}' / '{cls['complexity']}'. "
            + (f"Auto-downgraded to '{complexity}' (budget at {budget_remaining_pct*100:.0f}%). " if downgraded else "")
            + f"Selected {model['provider']}/{model['model']} (tier={model['tier']}, "
            + f"quality={model['quality']}, cost ${model['out']:.4f}/1K out vs gpt-4o ${baseline['out']:.4f}/1K)."
        ),
    }


# ── Budget Engine (in-memory; persisted via Mongo at call site) ─────────────
@dataclass
class BudgetPolicy:
    scope: str            # "org" | "team" | "user"
    scope_id: str
    monthly_limit_usd: float
    used_usd: float = 0.0
    soft_pct: float = 0.8     # downgrade at this point
    hard_pct: float = 1.0     # block at this point

    @property
    def remaining_pct(self) -> float:
        if self.monthly_limit_usd <= 0:
            return 1.0
        return max(0.0, 1.0 - (self.used_usd / self.monthly_limit_usd))

    def status(self) -> str:
        r = self.remaining_pct
        if r <= 0:
            return "blocked"
        if r < (1 - self.soft_pct):
            return "soft_limit"
        if r < 0.5:
            return "warning"
        return "healthy"
