"""Accounts: email + one-time 6-digit code -> opaque session token (Bearer). No passwords."""

import hashlib
import hmac
import re
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field

from . import db, mailer, settings

router = APIRouter(prefix="/v1", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(raw: str) -> str:
    email = raw.strip().lower()
    if len(email) > 254 or not EMAIL_RE.match(email):
        raise HTTPException(422, {"code": "invalid_email"})
    return email


def code_hash(email: str, code: str) -> bytes:
    # Keyed hash: a leaked table does not let anyone test the 10^6 possible codes offline.
    return hmac.new(settings.AUTH_SECRET.encode(), f"{email}|{code}".encode(), hashlib.sha256).digest()


def token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


class StartRequest(BaseModel):
    email: str = Field(max_length=320)
    lang: str = Field(default="en", max_length=5)


class VerifyRequest(BaseModel):
    email: str = Field(max_length=320)
    code: str = Field(min_length=6, max_length=6)
    deviceName: str | None = Field(default=None, max_length=100)


class SessionResponse(BaseModel):
    token: str
    userId: str
    email: str


class Me(BaseModel):
    id: str
    email: str


@router.post("/auth/email/start", status_code=204)
def start(req: StartRequest) -> Response:
    """Sends a login code. Same answer whether the account exists or not."""
    email = normalize_email(req.email)
    with db.pool().connection() as conn:
        conn.execute("DELETE FROM login_codes WHERE created_at < now() - interval '1 day'")
        recent = conn.execute(
            "SELECT count(*) AS n FROM login_codes WHERE email = %s AND created_at > now() - interval '1 hour'", (email,)
        ).fetchone()["n"]
        total = conn.execute("SELECT count(*) AS n FROM login_codes WHERE created_at > now() - interval '1 hour'").fetchone()["n"]
        if recent >= settings.LOGIN_CODES_PER_EMAIL_HOUR or total >= settings.LOGIN_CODES_TOTAL_HOUR:
            raise HTTPException(429, {"code": "too_many_codes"})
        code = f"{secrets.randbelow(10**6):06d}"
        conn.execute(
            "INSERT INTO login_codes (email, code_hash, expires_at) VALUES (%s, %s, now() + make_interval(mins => %s))",
            (email, code_hash(email, code), settings.LOGIN_CODE_TTL_MIN),
        )
    subject, text = mailer.login_message(code, req.lang)
    try:
        mailer.send(email, subject, text)
    except Exception:
        raise HTTPException(502, {"code": "email_failed"})
    return Response(status_code=204)


@router.post("/auth/email/verify", response_model=SessionResponse)
def verify(req: VerifyRequest) -> SessionResponse:
    email = normalize_email(req.email)
    # Errors are raised only after the block: raising inside would roll back the attempt counter.
    error = None
    with db.pool().connection() as conn:
        row = conn.execute(
            """SELECT id, code_hash, attempts FROM login_codes
               WHERE email = %s AND NOT used AND expires_at > now()
               ORDER BY created_at DESC LIMIT 1 FOR UPDATE""",
            (email,),
        ).fetchone()
        if row is None or row["attempts"] >= settings.LOGIN_CODE_MAX_ATTEMPTS:
            error = "code_expired"
        elif not hmac.compare_digest(bytes(row["code_hash"]), code_hash(email, req.code)):
            conn.execute("UPDATE login_codes SET attempts = attempts + 1 WHERE id = %s", (row["id"],))
            error = "wrong_code"
    if error:
        raise HTTPException(400, {"code": error})

    with db.pool().connection() as conn:
        # Mark used only if still unused: two parallel verifies cannot both get a session.
        if conn.execute("UPDATE login_codes SET used = true WHERE id = %s AND NOT used RETURNING id", (row["id"],)).fetchone() is None:
            raise HTTPException(400, {"code": "code_expired"})
        user = conn.execute(
            """INSERT INTO users (email) VALUES (%s)
               ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, email""",
            (email,),
        ).fetchone()
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, device_name) VALUES (%s, %s, %s)",
            (token_hash(token), user["id"], req.deviceName),
        )
    return SessionResponse(token=token, userId=str(user["id"]), email=user["email"])


def current_user(authorization: str = Header(default="")) -> Me:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401)
    with db.pool().connection() as conn:
        row = conn.execute(
            """UPDATE sessions SET last_used_at = now()
               WHERE token_hash = %s AND last_used_at > now() - make_interval(days => %s)
               RETURNING user_id""",
            (token_hash(token), settings.SESSION_IDLE_DAYS),
        ).fetchone()
        if row is None:
            raise HTTPException(401)
        user = conn.execute("SELECT id, email FROM users WHERE id = %s", (row["user_id"],)).fetchone()
    return Me(id=str(user["id"]), email=user["email"])


@router.get("/me", response_model=Me)
def me(user: Me = Depends(current_user)) -> Me:
    return user


@router.post("/auth/logout", status_code=204)
def logout(authorization: str = Header(default="")) -> Response:
    _, _, token = authorization.partition(" ")
    if token:
        with db.pool().connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = %s", (token_hash(token),))
    return Response(status_code=204)
