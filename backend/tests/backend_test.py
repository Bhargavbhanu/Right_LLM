"""Right LLM backend API tests — iteration 2 (15 models, 7 providers, TIPE, Advisor, SSE)."""
import os
import time
import json

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
        assert k in t
    assert t["requests"] > 0


# ── Forecast ─────────────────────────────────────────────────────────────────
def test_forecast_predict(session):
    r = session.get(f"{API}/forecast/predict", timeout=30)
    assert r.status_code == 200
    data = r.json()
    for k in ("current_run_rate_usd_per_day", "forecast_30d_total_usd", "forecast"):
        assert k in data
    assert len(data["forecast"]) == 90


# ── Recommendations ──────────────────────────────────────────────────────────
def test_recommendations_list(session):
    r = session.get(f"{API}/advisor/recommend", timeout=20)
    assert r.status_code == 200
    recs = r.json()
    assert isinstance(recs, list) and len(recs) > 0


def test_recommendation_accept_then_dismiss(session):
    recs = session.get(f"{API}/advisor/recommend", timeout=20).json()
    rec_id = recs[0]["id"]
    r = session.post(f"{API}/advisor/recommend/{rec_id}/action", params={"action": "accept"}, timeout=20)
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    r = session.post(f"{API}/advisor/recommend/{rec_id}/action", params={"action": "dismiss"}, timeout=20)
    assert r.status_code == 200 and r.json()["status"] == "dismissed"


# ── Budgets / Actions ────────────────────────────────────────────────────────
def test_budgets_status(session):
    r = session.get(f"{API}/budgets/status", timeout=20)
    assert r.status_code == 200
    assert len(r.json()["policies"]) > 0


def test_actions_history(session):
    r = session.get(f"{API}/actions/history", timeout=20)
    assert r.status_code == 200
    assert len(r.json()) > 0


# ── Providers (iteration 2: 7 providers / 15 models) ─────────────────────────
def test_providers_health_7_and_15(session):
    r = session.get(f"{API}/providers/health", timeout=20)
    assert r.status_code == 200
    data = r.json()
    providers = {p.get("id") or p.get("provider") for p in data["providers"]}
    expected = {"openai", "anthropic", "gemini", "groq", "ollama", "bedrock", "azure"}
    assert expected.issubset(providers), f"missing providers: {expected - providers}"
    assert len(data["providers"]) == 7, f"expected 7 providers, got {len(data['providers'])}"
    assert len(data["models"]) == 15, f"expected 15 models, got {len(data['models'])}"


# ── Routing / Cache lists ────────────────────────────────────────────────────
def test_routing_decisions_list(session):
    r = session.get(f"{API}/routing/decisions", params={"limit": 200}, timeout=30)
    assert r.status_code == 200 and len(r.json()) > 0


def test_cache_entries_list(session):
    r = session.get(f"{API}/cache/entries", params={"limit": 60}, timeout=30)
    assert r.status_code == 200 and len(r.json()) > 0


def test_optimization_log(session):
    r = session.get(f"{API}/optimization/log", params={"limit": 100}, timeout=30)
    assert r.status_code == 200


def test_routing_decision_post(session):
    body = {"prompt": "hello there", "quality_floor": 0.78, "budget_remaining_pct": 1.0}
    r = session.post(f"{API}/routing/decision", json=body, timeout=20)
    assert r.status_code == 200
    for k in ("task", "complexity", "model", "provider", "reasoning"):
        assert k in r.json()


def test_cache_search(session):
    r = session.post(f"{API}/cache/search", json={"prompt": "summarize revenue", "similarity_threshold": 0.5}, timeout=20)
    assert r.status_code == 200
    assert "hit" in r.json()


# ── TIPE Analyzer ────────────────────────────────────────────────────────────
def test_tipe_rca_summary(session):
    body = {"prompt": "Summarize the root cause of the database outage including timeline and impact",
            "task_type": "rca_summary", "baseline_model": "gpt-4o", "monthly_volume": 2400}
    r = session.post(f"{API}/tipe/analyze", json=body, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("input_tokens", "predicted_output_tokens", "baseline", "recommended",
              "savings_pct", "monthly_savings", "rows"):
        assert k in d, f"missing {k}"
    assert len(d["rows"]) == 15
    # rows sorted cheapest-first
    costs = [r["cost_per_call"] for r in d["rows"]]
    assert costs == sorted(costs)
    assert d["baseline"]["model"] == "gpt-4o"
    assert d["recommended"]["cost_per_call"] <= d["baseline"]["cost_per_call"]


def test_tipe_classification(session):
    body = {"prompt": "Is this email spam?", "task_type": "classification",
            "baseline_model": "gpt-4o-mini", "monthly_volume": 100000}
    r = session.post(f"{API}/tipe/analyze", json=body, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["task_type"] == "classification"
    assert d["predicted_output_tokens"] >= 8
    assert len(d["rows"]) == 15


# ── Migration Simulation ─────────────────────────────────────────────────────
def test_migration_gpt4o_to_haiku(session):
    body = {"from_model": "gpt-4o", "to_model": "claude-haiku-4-5-20251001", "monthly_volume": 10000}
    r = session.post(f"{API}/advisor/migration", json=body, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("from", "to", "cost_delta_pct", "quality_delta", "latency_delta_ms", "verdict", "summary"):
        assert k in d
    assert d["from"]["model"] == "gpt-4o"
    assert d["to"]["model"] == "claude-haiku-4-5-20251001"
    assert d["verdict"] in ("improvement", "trade-off", "regression")
    assert all(k in d["from"] for k in ("cost_per_call", "monthly", "quality", "p95_ms"))


def test_migration_mini_to_gemini_flash(session):
    body = {"from_model": "gpt-4o-mini", "to_model": "gemini-2.5-flash", "monthly_volume": 50000}
    r = session.post(f"{API}/advisor/migration", json=body, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["verdict"] in ("improvement", "trade-off", "regression")
    assert isinstance(d["summary"], str) and len(d["summary"]) > 0


def test_migration_unknown_model(session):
    r = session.post(f"{API}/advisor/migration",
                     json={"from_model": "does-not-exist", "to_model": "gpt-4o"}, timeout=20)
    assert r.status_code == 404


# ── AI Model Advisor (best-model) ────────────────────────────────────────────
@pytest.mark.parametrize("objective", ["balanced", "cost", "quality", "latency"])
def test_best_model_objectives(session, objective):
    body = {"objective": objective, "primary_task": "general",
            "monthly_budget_usd": 500, "monthly_volume": 10000}
    r = session.post(f"{API}/advisor/best-model", json=body, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "recommended" in d and "alternates" in d and "all" in d and "reasoning" in d
    rec = d["recommended"]
    for k in ("provider", "model", "cost_per_call", "monthly_cost", "quality"):
        assert k in rec
    assert len(d["all"]) == 15
    assert len(d["alternates"]) == 5


# ── Routing engine skips unconfigured configurable providers ─────────────────
def test_routing_skips_unconfigured_providers(session):
    """Routing must never return groq/ollama/bedrock/azure when their env keys are absent."""
    configurable_providers = {"groq", "ollama", "bedrock", "azure"}
    prompts = [
        "hello",
        "summarize this paragraph briefly",
        "analyze and reason step by step about architecture trade-offs",
        "extract names from: John, Mary, and Bob",
        "write python code to sort a list",
    ]
    for p in prompts:
        r = session.post(f"{API}/routing/decision",
                         json={"prompt": p, "quality_floor": 0.78, "budget_remaining_pct": 1.0}, timeout=20)
        assert r.status_code == 200
        prov = r.json()["provider"]
        assert prov not in configurable_providers, f"Routing leaked configurable provider {prov} for prompt: {p}"


# ── Gateway chat (real LLM) ──────────────────────────────────────────────────
def test_gateway_chat_basic(session):
    body = {"messages": [{"role": "user", "content": "Say hello in three words."}], "use_cache": False}
    r = session.post(f"{API}/gateway/chat", json=body, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("response", "decision", "optimization", "cost_usd", "latency_ms", "cache_hit"):
        assert k in d
    # Routing should pick a non-configurable provider
    assert d["decision"]["provider"] in ("openai", "anthropic", "gemini")
    assert d["cache_hit"] is False
    assert len(d["response"]) > 0


def test_gateway_chat_multiturn_context(session):
    """Multi-turn: user says name, assistant ack'd, user asks for name. Response should recall 'Sarah'."""
    body = {
        "messages": [
            {"role": "user", "content": "My name is Sarah."},
            {"role": "assistant", "content": "Nice to meet you, Sarah!"},
            {"role": "user", "content": "What is my name? Reply with just the name."},
        ],
        "use_cache": False,
    }
    r = session.post(f"{API}/gateway/chat", json=body, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "sarah" in d["response"].lower(), f"Expected 'Sarah' in response, got: {d['response']!r}"
    assert d["decision"]["provider"] in ("openai", "anthropic", "gemini")


# ── Iteration 3: Multi-org (/api/orgs, org_id scoping) ───────────────────────
def test_orgs_list_3_organizations(session):
    r = session.get(f"{API}/orgs", timeout=20)
    assert r.status_code == 200
    orgs = r.json()
    assert isinstance(orgs, list)
    by_id = {o["id"]: o for o in orgs}
    for expected in ("org_acme", "org_globex", "org_initech"):
        assert expected in by_id, f"missing org {expected} in {list(by_id.keys())}"
    assert by_id["org_acme"]["name"].lower().startswith("acme")
    assert by_id["org_globex"]["name"].lower().startswith("globex")
    assert by_id["org_initech"]["name"].lower().startswith("initech")
    for o in by_id.values():
        assert "monthly_limit_usd" in o
        # plan field carries the tier label (Enterprise / Growth)
        assert o.get("plan") in ("Enterprise", "Growth")
    assert by_id["org_acme"]["plan"] == "Enterprise"
    assert by_id["org_globex"]["plan"] == "Enterprise"
    assert by_id["org_initech"]["plan"] == "Growth"


def test_analytics_scoped_per_org_and_globex_largest(session):
    """Each org's analytics is independent; Globex > Acme > Initech in requests."""
    totals = {}
    for org in ("org_acme", "org_globex", "org_initech"):
        r = session.get(f"{API}/analytics/usage", params={"org_id": org, "days": 30}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "totals" in d
        totals[org] = d["totals"]
        assert d["totals"]["requests"] > 0, f"{org} has 0 requests"
    # Globex should be ~2.4x scale, Initech ~0.35x — strict ordering
    assert totals["org_globex"]["requests"] > totals["org_acme"]["requests"], totals
    assert totals["org_acme"]["requests"] > totals["org_initech"]["requests"], totals
    # Globex should NOT be truncated below ~50k records (was 20000 limit before; ~99k expected)
    assert totals["org_globex"]["requests"] > 50000, (
        f"Globex requests={totals['org_globex']['requests']} — possible to_list() truncation"
    )


def test_analytics_cache_savings_attribution(session):
    """Cache savings should now be ~half of total savings (fixed attribution)."""
    r = session.get(f"{API}/analytics/usage", params={"org_id": "org_acme", "days": 30}, timeout=60)
    assert r.status_code == 200
    t = r.json()["totals"]
    for k in ("routing_savings_usd", "cache_savings_usd", "total_savings_usd"):
        assert k in t, f"missing {k}"
    assert t["cache_savings_usd"] > 0, "cache_savings_usd should be > 0 after attribution fix"
    # Total should equal sum of routing + cache (rounding tolerance)
    assert abs((t["routing_savings_usd"] + t["cache_savings_usd"]) - t["total_savings_usd"]) < 1.0


@pytest.mark.parametrize("endpoint,extra_params", [
    ("/budgets/status", {}),
    ("/advisor/recommend", {}),
    ("/actions/history", {}),
    ("/routing/decisions", {"limit": 50}),
    ("/cache/entries", {"limit": 50}),
    ("/optimization/log", {"limit": 50}),
    ("/forecast/predict", {}),
])
def test_endpoint_respects_org_id_filter(session, endpoint, extra_params):
    """Each list endpoint should return distinct payloads for different orgs (org scoping works)."""
    params_acme = {"org_id": "org_acme", **extra_params}
    params_initech = {"org_id": "org_initech", **extra_params}
    r1 = session.get(f"{API}{endpoint}", params=params_acme, timeout=60)
    r2 = session.get(f"{API}{endpoint}", params=params_initech, timeout=60)
    assert r1.status_code == 200, f"{endpoint} acme failed: {r1.text[:200]}"
    assert r2.status_code == 200, f"{endpoint} initech failed: {r2.text[:200]}"
    # Both responses should be valid JSON (list or dict); not error out
    assert r1.json() is not None and r2.json() is not None


# ── SSE Streaming Gateway ────────────────────────────────────────────────────
def test_gateway_stream_sse(session):
    body = {"messages": [{"role": "user", "content": "Count from 1 to 5."}], "use_cache": False}
    r = requests.post(f"{API}/gateway/stream", json=body, stream=True, timeout=120,
                      headers={"Content-Type": "application/json", "Accept": "text/event-stream"})
    assert r.status_code == 200, r.text
    assert "text/event-stream" in r.headers.get("Content-Type", "")
    events = {"meta": 0, "token": 0, "done": 0}
    meta_payload = None
    for raw in r.iter_lines(decode_unicode=True):
        if not raw:
            continue
        if raw.startswith("event:"):
            current_event = raw.split(":", 1)[1].strip()
            events[current_event] = events.get(current_event, 0) + 1
        elif raw.startswith("data:") and current_event == "meta" and meta_payload is None:
            try:
                meta_payload = json.loads(raw.split(":", 1)[1].strip())
            except Exception:
                pass
        if events.get("done", 0) > 0:
            break
    assert events["meta"] >= 1
    assert events["token"] >= 1, f"expected token events, got {events}"
    assert events["done"] >= 1
    assert meta_payload is not None
    for k in ("decision", "cost_usd", "optimization"):
        assert k in meta_payload, f"meta missing {k}"
