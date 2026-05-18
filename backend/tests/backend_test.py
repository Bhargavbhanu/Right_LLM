"""Right LLM backend API tests"""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://smart-llm-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── Health ───────────────────────────────────────────────────────────────────
def test_health(session):
    r = session.get(f"{API}/health", timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ── Analytics ────────────────────────────────────────────────────────────────
def test_analytics_usage(session):
    r = session.get(f"{API}/analytics/usage", params={"days": 30}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "totals" in data and "by_day" in data and "by_model" in data
    t = data["totals"]
    for k in ("requests", "cache_hits", "total_savings_usd", "token_reduction_pct"):
        assert k in t, f"missing key {k}"
    assert isinstance(data["by_day"], list)
    assert isinstance(data["by_model"], list)
    assert t["requests"] > 0, "expected seeded request data"


# ── Forecast ─────────────────────────────────────────────────────────────────
def test_forecast_predict(session):
    r = session.get(f"{API}/forecast/predict", timeout=30)
    assert r.status_code == 200
    data = r.json()
    for k in ("current_run_rate_usd_per_day", "forecast_30d_total_usd", "forecast_60d_total_usd", "forecast_90d_total_usd", "forecast"):
        assert k in data, f"missing {k}"
    assert isinstance(data["forecast"], list)
    assert len(data["forecast"]) == 90


# ── Recommendations ──────────────────────────────────────────────────────────
def test_recommendations_list(session):
    r = session.get(f"{API}/advisor/recommend", timeout=20)
    assert r.status_code == 200
    recs = r.json()
    assert isinstance(recs, list)
    assert len(recs) > 0, "expected at least one seeded recommendation"
    for rec in recs:
        assert "id" in rec
        assert "estimated_monthly_savings_usd" in rec


def test_recommendation_accept_then_dismiss(session):
    recs = session.get(f"{API}/advisor/recommend", timeout=20).json()
    assert len(recs) >= 1
    rec_id = recs[0]["id"]
    # Accept
    r = session.post(f"{API}/advisor/recommend/{rec_id}/action", params={"action": "accept"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"
    # Verify persisted
    updated = session.get(f"{API}/advisor/recommend", timeout=20).json()
    target = next((x for x in updated if x["id"] == rec_id), None)
    assert target and target["status"] == "accepted"
    # Dismiss
    r = session.post(f"{API}/advisor/recommend/{rec_id}/action", params={"action": "dismiss"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "dismissed"


def test_recommendation_invalid_action(session):
    recs = session.get(f"{API}/advisor/recommend", timeout=20).json()
    rec_id = recs[0]["id"]
    r = session.post(f"{API}/advisor/recommend/{rec_id}/action", params={"action": "frobnicate"}, timeout=20)
    assert r.status_code == 400


# ── Budgets ──────────────────────────────────────────────────────────────────
def test_budgets_status(session):
    r = session.get(f"{API}/budgets/status", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "policies" in data
    assert isinstance(data["policies"], list)
    assert len(data["policies"]) > 0
    p = data["policies"][0]
    for k in ("scope", "burn_pct", "status"):
        assert k in p


# ── Actions ──────────────────────────────────────────────────────────────────
def test_actions_history(session):
    r = session.get(f"{API}/actions/history", timeout=20)
    assert r.status_code == 200
    actions = r.json()
    assert isinstance(actions, list)
    assert len(actions) > 0
    a = actions[0]
    for k in ("type", "summary", "outcome", "status"):
        assert k in a, f"missing {k} in action"


# ── Providers ────────────────────────────────────────────────────────────────
def test_providers_health(session):
    r = session.get(f"{API}/providers/health", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "providers" in data and "models" in data
    assert len(data["providers"]) > 0
    assert len(data["models"]) > 0


# ── Routing decisions list ───────────────────────────────────────────────────
def test_routing_decisions_list(session):
    r = session.get(f"{API}/routing/decisions", params={"limit": 200}, timeout=30)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) > 0


# ── Cache entries list ───────────────────────────────────────────────────────
def test_cache_entries_list(session):
    r = session.get(f"{API}/cache/entries", params={"limit": 60}, timeout=30)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) > 0


# ── Optimization log ─────────────────────────────────────────────────────────
def test_optimization_log(session):
    r = session.get(f"{API}/optimization/log", params={"limit": 100}, timeout=30)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)


# ── Routing decision (no LLM) ────────────────────────────────────────────────
def test_routing_decision_post_simple(session):
    body = {"prompt": "hello there", "quality_floor": 0.78, "budget_remaining_pct": 1.0}
    r = session.post(f"{API}/routing/decision", json=body, timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ("task", "complexity", "model", "provider", "reasoning"):
        assert k in data, f"missing {k}"


def test_routing_decision_post_complex(session):
    body = {"prompt": "analyze and reason step by step about the architecture trade-offs", "quality_floor": 0.85, "budget_remaining_pct": 1.0}
    r = session.post(f"{API}/routing/decision", json=body, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["complexity"] in ("complex", "critical", "moderate")


# ── Cache search ─────────────────────────────────────────────────────────────
def test_cache_search(session):
    body = {"prompt": "summarize quarterly revenue", "similarity_threshold": 0.5}
    r = session.post(f"{API}/cache/search", json=body, timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ("hit", "similarity", "threshold"):
        assert k in data


# ── Gateway chat (real LLM) ──────────────────────────────────────────────────
def test_gateway_chat_basic(session):
    body = {
        "messages": [{"role": "user", "content": "Say hello in three words."}],
        "use_cache": False,
        "similarity_threshold": 0.92,
    }
    r = session.post(f"{API}/gateway/chat", json=body, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("response", "decision", "optimization", "cost_usd", "latency_ms", "cache_hit"):
        assert k in data, f"missing {k}"
    d = data["decision"]
    for k in ("task", "complexity", "model", "provider", "reasoning"):
        assert k in d
    o = data["optimization"]
    for k in ("before_tokens", "after_tokens", "saved_tokens"):
        assert k in o
    assert data["cache_hit"] is False
    assert len(data["response"]) > 0


def test_gateway_chat_simple_routes_to_cheap(session):
    body = {
        "messages": [{"role": "user", "content": "hello"}],
        "use_cache": False,
    }
    r = session.post(f"{API}/gateway/chat", json=body, timeout=90)
    assert r.status_code == 200
    data = r.json()
    model = data["decision"]["model"].lower()
    # cheapest by weighted output (in*0.3 + out*0.7); should be a 'simple' tier model
    assert ("gemini" in model and "flash" in model) or "gpt-4o-mini" in model, f"unexpected model for simple prompt: {model}"


def test_gateway_chat_cache_hit_on_repeat(session):
    unique = f"What is the capital of testland-{int(time.time())}?"
    body = {
        "messages": [{"role": "user", "content": unique}],
        "use_cache": True,
        "similarity_threshold": 0.92,
    }
    # First call — populates cache
    r1 = session.post(f"{API}/gateway/chat", json=body, timeout=90)
    assert r1.status_code == 200
    assert r1.json()["cache_hit"] is False
    # Second identical call — should hit L1 cache
    r2 = session.post(f"{API}/gateway/chat", json=body, timeout=30)
    assert r2.status_code == 200
    data = r2.json()
    assert data["cache_hit"] is True, f"expected cache hit, got {data}"
    assert data.get("cache_layer") in ("L1", "L2")
    assert data["cost_usd"] == 0.0
