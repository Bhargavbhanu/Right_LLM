"""Iteration-7 smoke + new-behavior verification.

Covers:
  • All 12 mounted feature routers respond
  • Every response carries an X-Request-Id header
  • /api/gateway/chat: 1st call cache_hit=False, 2nd identical call → L1 hit,
    near-paraphrase → L2 hit with similarity >= 0.85
  • SSE streaming still works
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://refactor-hub-33.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


# ── Auth helper ──────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token() -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"email": "admin@right-llm.dev", "password": "RightLLM2026!"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


# ── 1. Smoke-verify GETs respond + X-Request-Id ───────────────────────────
ENDPOINTS_GET = [
    ("/", None),
    ("/health", None),
    ("/orgs", None),
    ("/analytics/usage", {"org_id": "org_acme"}),
    ("/forecast/predict", {"org_id": "org_acme"}),
    ("/budgets/status", {"org_id": "org_acme"}),
    ("/routing/decisions", {"org_id": "org_acme", "limit": 5}),
    ("/cache/entries", {"org_id": "org_acme", "limit": 5}),
    ("/providers/health", None),
    ("/optimization/log", {"org_id": "org_acme", "limit": 5}),
    ("/actions/history", {"org_id": "org_acme", "limit": 5}),
    ("/advisor/recommend", {"org_id": "org_acme"}),
    ("/auth/me", None),
    ("/settings/providers", None),
]


@pytest.mark.parametrize("path,params", ENDPOINTS_GET)
def test_get_endpoint_responds_and_has_request_id(path, params, admin_headers):
    r = requests.get(f"{API}{path}", params=params, headers=admin_headers, timeout=20)
    assert r.status_code == 200, f"{path} → {r.status_code} {r.text[:200]}"
    rid = r.headers.get("X-Request-Id")
    assert rid and len(rid) >= 8, f"{path} missing X-Request-Id (got {rid!r})"


# ── 2. POST smoke — correct payload shapes ────────────────────────────────
def test_routing_decision_post(admin_headers):
    r = requests.post(
        f"{API}/routing/decision",
        json={"prompt": "Summarize this article briefly."},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    assert "X-Request-Id" in r.headers
    assert "model" in r.json()


def test_cache_search_post(admin_headers):
    r = requests.post(
        f"{API}/cache/search",
        json={"prompt": "hello world", "similarity_threshold": 0.5},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    assert "X-Request-Id" in r.headers


def test_tipe_analyze(admin_headers):
    r = requests.post(
        f"{API}/tipe/analyze",
        json={"prompt": "Summarize the quarterly earnings report.",
              "task_type": "rca_summary", "baseline_model": "gpt-4o",
              "monthly_volume": 1000},
        headers=admin_headers, timeout=20,
    )
    assert r.status_code == 200, r.text
    assert "recommended" in r.json()
    assert "X-Request-Id" in r.headers


def test_advisor_migration(admin_headers):
    r = requests.post(
        f"{API}/advisor/migration",
        json={"from_model": "gpt-4o", "to_model": "claude-haiku-4-5-20251001",
              "monthly_volume": 5000},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    assert "X-Request-Id" in r.headers


def test_advisor_best_model_post(admin_headers):
    r = requests.post(
        f"{API}/advisor/best-model",
        json={"objective": "balanced", "primary_task": "general",
              "monthly_budget_usd": 500, "monthly_volume": 5000},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    assert "recommended" in r.json()


# ── 3. Gateway chat: L1 exact cache hit ───────────────────────────────────
def test_chat_l1_exact_cache_hit(admin_headers):
    """1st call → MISS. 2nd identical call → L1 hit."""
    unique = uuid.uuid4().hex[:8]
    msgs = [{"role": "user",
             "content": f"What is the capital of France? token={unique}"}]
    headers = {**admin_headers, "X-Org-Id": "org_acme"}
    payload = {"messages": msgs, "use_cache": True, "org_id": "org_acme"}

    r1 = requests.post(f"{API}/gateway/chat", json=payload, headers=headers, timeout=60)
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    assert d1.get("cache_hit") is False, f"1st call unexpectedly hit cache: {d1}"
    assert "X-Request-Id" in r1.headers

    r2 = requests.post(f"{API}/gateway/chat", json=payload, headers=headers, timeout=60)
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2.get("cache_hit") is True, f"2nd identical call should hit cache: {d2}"
    assert d2.get("cache_layer") == "L1", f"Expected L1, got: {d2.get('cache_layer')}"


# ── 4. Gateway chat: L2 semantic cache hit (near-paraphrase) ──────────────
def test_chat_l2_semantic_cache_hit(admin_headers):
    """Seed unique prompt then send near-paraphrase. Expect L2 hit, sim >= 0.85.

    Uses similarity_threshold=0.85 (review-request spec) since the deterministic
    512-d hash embedding is the active fallback (OPENAI_API_KEY not set).
    """
    unique = uuid.uuid4().hex[:8]
    seed = ("Please explain how photosynthesis converts sunlight into chemical "
            f"energy in plants. Reference {unique}.")
    paraphrase = ("Please explain how photosynthesis converts sunlight into chemical "
                  f"energy within plants. Reference {unique}.")
    headers = {**admin_headers, "X-Org-Id": "org_acme"}

    rs = requests.post(
        f"{API}/gateway/chat",
        json={"messages": [{"role": "user", "content": seed}],
              "use_cache": True, "similarity_threshold": 0.85},
        headers=headers, timeout=60,
    )
    assert rs.status_code == 200, rs.text

    rp = requests.post(
        f"{API}/gateway/chat",
        json={"messages": [{"role": "user", "content": paraphrase}],
              "use_cache": True, "similarity_threshold": 0.85},
        headers=headers, timeout=60,
    )
    assert rp.status_code == 200, rp.text
    dp = rp.json()
    assert dp.get("cache_hit") is True, f"Paraphrase did not hit cache: {dp}"
    layer = dp.get("cache_layer")
    sim = dp.get("similarity") or 0
    assert layer == "L2", f"Expected L2, got: {layer} (full: {dp})"
    assert sim >= 0.85, f"Similarity {sim} below threshold 0.85"


# ── 5. SSE smoke ──────────────────────────────────────────────────────────
def test_gateway_stream_sse_smoke(admin_headers):
    headers = {**admin_headers, "X-Org-Id": "org_acme"}
    with requests.post(
        f"{API}/gateway/stream",
        json={"messages": [{"role": "user", "content": "Say hi."}], "use_cache": False},
        headers=headers, stream=True, timeout=60,
    ) as r:
        assert r.status_code == 200
        assert "X-Request-Id" in r.headers
        got = 0
        for line in r.iter_lines():
            if line:
                got += 1
                break
        assert got >= 1


# ── 6. Verify request-id appears in backend logs ──────────────────────────
def test_backend_logs_include_request_id_field():
    """Sample backend log file and confirm structured `[request_id]` field is present."""
    import subprocess
    # Trigger a request to ensure a fresh log line
    r = requests.get(f"{API}/orgs", timeout=10)
    assert r.status_code == 200
    rid = r.headers.get("X-Request-Id")
    assert rid

    # Read tail of the backend log
    log_files = [
        "/var/log/supervisor/backend.out.log",
        "/var/log/supervisor/backend.err.log",
    ]
    found = False
    for path in log_files:
        try:
            out = subprocess.run(["tail", "-n", "200", path],
                                 capture_output=True, text=True, timeout=5)
            # Logger format: "<ts> [<rid>] rightllm INFO: GET /api/orgs -> 200 in Xms"
            if "[" in out.stdout and "rightllm" in out.stdout:
                # find any line with bracketed request-id field
                for line in out.stdout.splitlines():
                    if "rightllm" in line and "[" in line and "]" in line:
                        # extract bracket content
                        try:
                            bracket = line.split("[", 1)[1].split("]", 1)[0]
                            if bracket and bracket != "-":
                                found = True
                                break
                        except IndexError:
                            continue
            if found:
                break
        except Exception:
            continue
    assert found, "Expected `[<request_id>] rightllm` log line in backend logs"
