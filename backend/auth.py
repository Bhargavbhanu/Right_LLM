"""Custom JWT auth — login / register / me / refresh / logout + RBAC + admin seeding.

Stateful Bearer-token auth (kept simple — no httpOnly cookies because the existing frontend
uses axios with REACT_APP_BACKEND_URL and we do not control SameSite cross-origin cookies
in the preview environment). The frontend stores the access token in localStorage and an
axios interceptor injects it as `Authorization: Bearer …` on every request.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

JWT_ALG = "HS256"
ACCESS_TTL = timedelta(days=7)

bearer_scheme = HTTPBearer(auto_error=False)
auth_router = APIRouter(prefix="/auth", tags=["auth"])


# ── Models ──────────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=80)
    org_id: str = "org_acme"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    org_id: str
    created_at: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


# ── Hashing ────────────────────────────────────────────────────────────────
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT ────────────────────────────────────────────────────────────────────
def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str, org_id: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "org_id": org_id,
        "exp": datetime.now(timezone.utc) + ACCESS_TTL,
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def _user_to_out(doc: dict) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        email=doc["email"],
        name=doc.get("name", ""),
        role=doc.get("role", "member"),
        org_id=doc.get("org_id", "org_acme"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)).isoformat(),
    )


# ── Dependencies ───────────────────────────────────────────────────────────
async def _decode(token: str) -> dict:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user_factory(db_getter):
    """Returns a FastAPI dependency that loads the current user from the DB.

    The factory pattern avoids a circular import on `db` from server.py at module load.
    """

    async def get_current_user(
        creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    ) -> dict:
        if not creds or not creds.credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = await _decode(creds.credentials)
        db = db_getter()
        try:
            user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid user id")
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user

    return get_current_user


def require_role(*roles: str):
    """Dependency factory for role-gated endpoints."""

    def _check(user: dict = Depends(lambda: None)):  # placeholder, replaced at wire-time
        if user is None or user.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(roles)}")
        return user

    return _check


# ── Endpoints ──────────────────────────────────────────────────────────────
def build_auth_router(db, get_current_user):
    """Build and return the configured auth router.

    `db` is the motor database instance; `get_current_user` is the auth dependency.
    """

    @auth_router.post("/register", response_model=AuthOut)
    async def register(body: RegisterIn) -> AuthOut:
        email = body.email.lower().strip()
        exists = await db.users.find_one({"email": email})
        if exists:
            raise HTTPException(status_code=409, detail="Email already registered")
        doc = {
            "email": email,
            "name": body.name.strip(),
            "password_hash": hash_password(body.password),
            "role": "member",
            "org_id": body.org_id,
            "created_at": datetime.now(timezone.utc),
        }
        res = await db.users.insert_one(doc)
        user_id = str(res.inserted_id)
        token = create_access_token(user_id, email, "member", body.org_id)
        doc["_id"] = res.inserted_id
        return AuthOut(token=token, user=_user_to_out(doc))

    @auth_router.post("/login", response_model=AuthOut)
    async def login(body: LoginIn, request: Request) -> AuthOut:
        email = body.email.lower().strip()

        # Brute force protection — 5 fails in 15 min
        ip = request.client.host if request.client else "unknown"
        key = f"{ip}:{email}"
        now = datetime.now(timezone.utc)
        attempt = await db.login_attempts.find_one({"identifier": key})
        if attempt and attempt.get("locked_until") and attempt["locked_until"] > now:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

        user = await db.users.find_one({"email": email})
        if not user or not verify_password(body.password, user["password_hash"]):
            # increment failed attempts
            new_fails = (attempt or {}).get("fails", 0) + 1
            update = {"fails": new_fails, "last_at": now}
            if new_fails >= 5:
                update["locked_until"] = now + timedelta(minutes=15)
            await db.login_attempts.update_one(
                {"identifier": key}, {"$set": {"identifier": key, **update}}, upsert=True
            )
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Success — clear lockout
        await db.login_attempts.delete_one({"identifier": key})
        token = create_access_token(
            str(user["_id"]), email, user.get("role", "member"), user.get("org_id", "org_acme")
        )
        return AuthOut(token=token, user=_user_to_out(user))

    @auth_router.get("/me", response_model=UserOut)
    async def me(user: dict = Depends(get_current_user)) -> UserOut:
        return _user_to_out({**user, "_id": user["_id"]})

    @auth_router.post("/logout")
    async def logout(user: dict = Depends(get_current_user)) -> dict:
        # Stateless JWT — client just discards the token. Kept as an endpoint
        # for symmetry + future server-side revocation list.
        return {"ok": True}

    return auth_router


# ── Admin seeding ──────────────────────────────────────────────────────────
async def seed_users(db) -> None:
    """Create admin + demo user accounts on startup. Idempotent."""
    admin_email = os.environ["ADMIN_EMAIL"].lower().strip()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    demo_email = os.environ["DEMO_USER_EMAIL"].lower().strip()
    demo_pw = os.environ["DEMO_USER_PASSWORD"]

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier", unique=True)

    async def upsert(email: str, password: str, name: str, role: str, org_id: str) -> None:
        existing = await db.users.find_one({"email": email})
        if existing is None:
            await db.users.insert_one(
                {
                    "email": email,
                    "name": name,
                    "password_hash": hash_password(password),
                    "role": role,
                    "org_id": org_id,
                    "created_at": datetime.now(timezone.utc),
                }
            )
            logger.info("Seeded %s user (%s)", role, email)
        else:
            # Re-sync password if .env changed
            if not verify_password(password, existing["password_hash"]):
                await db.users.update_one(
                    {"email": email}, {"$set": {"password_hash": hash_password(password)}}
                )
                logger.info("Updated %s password (%s)", role, email)

    await upsert(admin_email, admin_pw, "Platform Admin", "admin", "org_acme")
    await upsert(demo_email, demo_pw, "Demo User", "member", "org_acme")
