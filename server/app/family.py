"""Family group: one family per user, single-use invites, admin approves new members.

The family key never reaches the server: it travels in the invite link fragment (see docs/threat-model.md).
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from . import db, settings
from .auth import Me, current_user, token_hash

router = APIRouter(prefix="/v1", tags=["family"])

INVITE_TTL_HOURS = 24


class Member(BaseModel):
    userId: str
    email: str
    role: str
    status: str


class Family(BaseModel):
    id: str
    myRole: str
    myStatus: str
    members: list[Member]


class Invite(BaseModel):
    familyId: str
    token: str
    expiresAt: str


class JoinRequest(BaseModel):
    familyId: str = Field(max_length=36)
    token: str = Field(max_length=100)


def membership(conn, user_id: str) -> dict | None:
    return conn.execute("SELECT family_id, role, status FROM family_members WHERE user_id = %s", (user_id,)).fetchone()


def require_admin(conn, user_id: str) -> dict:
    m = membership(conn, user_id)
    if m is None or m["role"] != "admin":
        raise HTTPException(403, {"code": "not_admin"})
    return m


def member_limit() -> int:
    # TODO(M4): Plus families get limits.plus.familyMembers.
    return settings.TIERS["limits"]["free"]["familyMembers"]


def load_family(conn, user_id: str) -> Family:
    m = membership(conn, user_id)
    if m is None:
        raise HTTPException(404, {"code": "no_family"})
    rows = conn.execute(
        """SELECT u.id, u.email, fm.role, fm.status FROM family_members fm JOIN users u ON u.id = fm.user_id
           WHERE fm.family_id = %s ORDER BY fm.joined_at""",
        (m["family_id"],),
    ).fetchall()
    return Family(
        id=str(m["family_id"]),
        myRole=m["role"],
        myStatus=m["status"],
        members=[Member(userId=str(r["id"]), email=r["email"], role=r["role"], status=r["status"]) for r in rows],
    )


def remove_member(conn, family_id, user_id) -> None:
    """Removes a member; hands admin over to the longest active member, deletes an empty family."""
    conn.execute("DELETE FROM family_members WHERE family_id = %s AND user_id = %s", (family_id, user_id))
    # Their own records (e.g. last location, M6) go with them.
    conn.execute("DELETE FROM records WHERE family_id = %s AND type = 'last_location' AND id = %s", (family_id, user_id))
    left = conn.execute(
        "SELECT user_id, role, status FROM family_members WHERE family_id = %s ORDER BY joined_at", (family_id,)
    ).fetchall()
    active = [r for r in left if r["status"] == "active"]
    if not active:
        conn.execute("DELETE FROM families WHERE id = %s", (family_id,))
    elif not any(r["role"] == "admin" for r in active):
        conn.execute(
            "UPDATE family_members SET role = 'admin' WHERE family_id = %s AND user_id = %s", (family_id, active[0]["user_id"])
        )


@router.post("/families", response_model=Family)
def create_family(user: Me = Depends(current_user)) -> Family:
    with db.pool().connection() as conn:
        if membership(conn, user.id):
            raise HTTPException(409, {"code": "already_in_family"})
        fam = conn.execute("INSERT INTO families DEFAULT VALUES RETURNING id").fetchone()
        conn.execute(
            "INSERT INTO family_members (family_id, user_id, role, status) VALUES (%s, %s, 'admin', 'active')",
            (fam["id"], user.id),
        )
        return load_family(conn, user.id)


@router.get("/family", response_model=Family)
def get_family(user: Me = Depends(current_user)) -> Family:
    with db.pool().connection() as conn:
        return load_family(conn, user.id)


@router.post("/family/invites", response_model=Invite)
def create_invite(user: Me = Depends(current_user)) -> Invite:
    with db.pool().connection() as conn:
        m = require_admin(conn, user.id)
        count = conn.execute("SELECT count(*) AS n FROM family_members WHERE family_id = %s", (m["family_id"],)).fetchone()["n"]
        if count >= member_limit():
            raise HTTPException(403, {"code": "member_limit", "max": member_limit()})
        token = secrets.token_urlsafe(24)
        row = conn.execute(
            """INSERT INTO invites (token_hash, family_id, created_by, expires_at)
               VALUES (%s, %s, %s, now() + make_interval(hours => %s)) RETURNING expires_at""",
            (token_hash(token), m["family_id"], user.id, INVITE_TTL_HOURS),
        ).fetchone()
    return Invite(familyId=str(m["family_id"]), token=token, expiresAt=row["expires_at"].isoformat())


@router.post("/families/join", response_model=Family)
def join(req: JoinRequest, user: Me = Depends(current_user)) -> Family:
    error = None
    with db.pool().connection() as conn:
        if membership(conn, user.id):
            error = (409, "already_in_family")
        else:
            inv = conn.execute(
                """UPDATE invites SET used_at = now()
                   WHERE token_hash = %s AND family_id::text = %s AND used_at IS NULL AND expires_at > now()
                   RETURNING family_id""",
                (token_hash(req.token), req.familyId),
            ).fetchone()
            if inv is None:
                error = (400, "invite_invalid")
            else:
                count = conn.execute(
                    "SELECT count(*) AS n FROM family_members WHERE family_id = %s", (inv["family_id"],)
                ).fetchone()["n"]
                if count >= member_limit():
                    # Roll back the invite use too: the admin can free a place and the same invite still works.
                    conn.rollback()
                    error = (403, "member_limit")
                else:
                    conn.execute(
                        "INSERT INTO family_members (family_id, user_id, role, status) VALUES (%s, %s, 'member', 'pending')",
                        (inv["family_id"], user.id),
                    )
                    return load_family(conn, user.id)
    raise HTTPException(error[0], {"code": error[1]})


@router.post("/family/members/{member_id}/approve", status_code=204)
def approve(member_id: str, user: Me = Depends(current_user)) -> Response:
    with db.pool().connection() as conn:
        m = require_admin(conn, user.id)
        done = conn.execute(
            "UPDATE family_members SET status = 'active' WHERE family_id = %s AND user_id::text = %s RETURNING user_id",
            (m["family_id"], member_id),
        ).fetchone()
    if done is None:
        raise HTTPException(404)
    return Response(status_code=204)


@router.delete("/family/members/{member_id}", status_code=204)
def remove(member_id: str, user: Me = Depends(current_user)) -> Response:
    """Admin removes (or rejects) a member; 'me' leaves the family."""
    with db.pool().connection() as conn:
        if member_id == "me":
            m = membership(conn, user.id)
            if m is None:
                raise HTTPException(404)
            remove_member(conn, m["family_id"], user.id)
        else:
            m = require_admin(conn, user.id)
            target = conn.execute(
                "SELECT user_id FROM family_members WHERE family_id = %s AND user_id::text = %s", (m["family_id"], member_id)
            ).fetchone()
            if target is None:
                raise HTTPException(404)
            remove_member(conn, m["family_id"], target["user_id"])
    return Response(status_code=204)
