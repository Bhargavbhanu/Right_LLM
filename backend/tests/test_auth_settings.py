"""Auth + Settings tests — iteration 5 (JWT auth, RBAC, provider keys, rate limit)."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://refactor-hub-33.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@right-llm.dev"
ADMIN_PASSWORD = "RightLLM2026!"
DEMO_EMAIL = "demo@right-llm.dev"
DEMO_PASSWORD = "DemoUser2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, email, password):
    return s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)


# ── Login ────────────────────────────────────────────────────────────────────
def test_login_admin_success(session):
    r = _login(session, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
    assert data["user"]["role"] == "admin"
    assert data["user"]["email"] == ADMIN_EMAIL


def test_login_demo_member(session):
    r = _login(session, DEMO_EMAIL, DEMO_PASSWORD)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "member"
    assert data["user"]["email"] == DEMO_EMAIL


def test_login_wrong_password(session):
    # Use a unique email to avoid triggering lockout from other tests
    r = session.post(
        f"{API}/auth/login",
        json={"email": "no-such-user@right-llm.dev", "password": "wrongpass"},
        timeout=20,
    )
    assert r.status_code == 401
    assert "Invalid email or password" in r.text


# ── /me ──────────────────────────────────────────────────────────────────────
def test_me_with_valid_token(session):
    r = _login(session, ADMIN_EMAIL, ADMIN_PASSWORD)
    token = r.json()["token"]
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert me.status_code == 200
    assert me.json()["email"] == ADMIN_EMAIL
    assert me.json()["role"] == "admin"


def test_me_without_token():
    r = requests.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 401


def test_me_with_invalid_token():
    r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"}, timeout=20)
    assert r.status_code == 401


# ── Logout ───────────────────────────────────────────────────────────────────
def test_logout_authenticated(session):
    r = _login(session, ADMIN_EMAIL, ADMIN_PASSWORD)
    token = r.json()["token"]
    out = requests.post(
        f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"}, timeout=20
    )
    assert out.status_code == 200
    assert out.json().get("ok") is True


# ── Register ─────────────────────────────────────────────────────────────────
def test_register_new_member(session):
    uniq = uuid.uuid4().hex[:10]
    email = f"TEST_{uniq}@right-llm.dev"
    r = session.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Password123!", "name": "Test User"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    # Server lowercases the email before storing
    assert data["user"]["email"].lower() == email.lower()
    assert data["user"]["role"] == "member"
    assert "token" in data


def test_register_duplicate_email(session):
    r = session.post(
        f"{API}/auth/register",
        json={"email": ADMIN_EMAIL, "password": "Password123!", "name": "Dup"},
        timeout=20,
    )
    assert r.status_code == 409


def test_register_password_too_short(session):
    r = session.post(
        f"{API}/auth/register",
        json={"email": f"TEST_{uuid.uuid4().hex[:8]}@right-llm.dev", "password": "abc", "name": "x"},
        timeout=20,
    )
    assert r.status_code == 422


# ── Settings — admin/member access ───────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20
    )
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(
        f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=20
    )
    assert r.status_code == 200
    return r.json()["token"]


def test_settings_get_requires_admin_returns_4_providers(admin_token):
    r = requests.get(
        f"{API}/settings/providers",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200
    data = r.json()
    providers = data.get("providers", [])
    names = {p["provider"] for p in providers}
    assert names == {"groq", "ollama", "bedrock", "azure"}
    # Each provider has fields list, configured flag
    for p in providers:
        assert "fields" in p and isinstance(p["fields"], list) and len(p["fields"]) >= 1
        assert "configured" in p and isinstance(p["configured"], bool)
        for f in p["fields"]:
            assert "key" in f and "label" in f and "masked" in f and "has_value" in f


def test_settings_member_forbidden(demo_token):
    r = requests.get(
        f"{API}/settings/providers",
        headers={"Authorization": f"Bearer {demo_token}"},
        timeout=20,
    )
    assert r.status_code == 403


def test_settings_no_token_returns_401():
    r = requests.get(f"{API}/settings/providers", timeout=20)
    assert r.status_code == 401


# ── Settings — PUT/DELETE round-trip ─────────────────────────────────────────
def test_settings_put_then_get_then_delete_groq(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    # PUT
    put = requests.put(
        f"{API}/settings/providers",
        headers=headers,
        json={"provider": "groq", "values": {"GROQ_API_KEY": "gsk_test123456789abcdef"}},
        timeout=20,
    )
    assert put.status_code == 200, put.text
    assert put.json().get("ok") is True
    assert put.json().get("configured") is True

    # GET — verify configured=true and masked
    g = requests.get(f"{API}/settings/providers", headers=headers, timeout=20).json()
    groq = next(p for p in g["providers"] if p["provider"] == "groq")
    assert groq["configured"] is True
    api_key_field = next(f for f in groq["fields"] if f["key"] == "GROQ_API_KEY")
    assert api_key_field["has_value"] is True
    assert api_key_field["source"] == "db"
    # Plaintext must not leak — must be masked with bullet/ellipsis
    assert "gsk_test123456789abcdef" not in str(api_key_field["masked"])

    # DELETE
    d = requests.delete(
        f"{API}/settings/providers/groq", headers=headers, timeout=20
    )
    assert d.status_code == 200
    assert d.json().get("ok") is True

    # GET after delete — configured back to false (unless env var set)
    g2 = requests.get(f"{API}/settings/providers", headers=headers, timeout=20).json()
    groq2 = next(p for p in g2["providers"] if p["provider"] == "groq")
    api_key_field2 = next(f for f in groq2["fields"] if f["key"] == "GROQ_API_KEY")
    # If env has no GROQ_API_KEY, it should now be unconfigured
    if not os.environ.get("GROQ_API_KEY"):
        assert groq2["configured"] is False
        assert api_key_field2["has_value"] is False


def test_settings_put_demo_member_forbidden(demo_token):
    r = requests.put(
        f"{API}/settings/providers",
        headers={"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"},
        json={"provider": "groq", "values": {"GROQ_API_KEY": "should_not_save"}},
        timeout=20,
    )
    assert r.status_code == 403


# ── Brute-force lockout ──────────────────────────────────────────────────────
def test_brute_force_lockout_after_5_fails():
    # Use a unique email so we don't lock out a real user
    bad_email = f"TEST_brute_{uuid.uuid4().hex[:6]}@right-llm.dev"
    last = None
    for _ in range(6):
        last = requests.post(
            f"{API}/auth/login",
            json={"email": bad_email, "password": "wrongwrong"},
            timeout=20,
        )
    # After 5 fails the 6th should be 429 (locked)
    assert last is not None
    assert last.status_code == 429, f"Expected 429 after 5 fails, got {last.status_code}: {last.text}"


# ── Rate limit on /api/gateway/chat ─────────────────────────────────────────
def test_gateway_chat_rate_limit_429():
    """Fire >60 chat requests to trigger slowapi 60/min rate limit.

    Uses a fixed X-Org-Id so the limiter key is stable even if the proxy rotates
    the client IP across k8s ingress replicas.
    """
    saw_429 = False
    org_id = f"TEST_rl_{uuid.uuid4().hex[:6]}"
    for i in range(75):
        try:
            r = requests.post(
                f"{API}/gateway/chat",
                json={"messages": [{"role": "user", "content": "ping"}], "org_id": "org_acme"},
                headers={"X-Org-Id": org_id},
                timeout=10,
            )
        except Exception:
            continue
        if r.status_code == 429:
            saw_429 = True
            break
    assert saw_429, "Expected at least one 429 within 75 requests"
