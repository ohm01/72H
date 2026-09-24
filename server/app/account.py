"""GDPR: export what the server knows about me, delete my account."""

from fastapi import APIRouter, Depends, Response

from . import db
from .auth import Me, current_user
from .family import membership, remove_member

router = APIRouter(prefix="/v1", tags=["account"])


@router.get("/me/export")
def export(user: Me = Depends(current_user)) -> dict:
    """Account data in readable form. Family records are encrypted; the app exports their plaintext itself."""
    with db.pool().connection() as conn:
        account = conn.execute("SELECT id, email, created_at FROM users WHERE id = %s", (user.id,)).fetchone()
        sessions = conn.execute(
            "SELECT device_name, created_at, last_used_at FROM sessions WHERE user_id = %s ORDER BY created_at", (user.id,)
        ).fetchall()
        m = conn.execute(
            "SELECT family_id, role, status, joined_at FROM family_members WHERE user_id = %s", (user.id,)
        ).fetchone()
    return {
        "account": {"id": str(account["id"]), "email": account["email"], "createdAt": account["created_at"].isoformat()},
        "devices": [
            {"name": s["device_name"], "createdAt": s["created_at"].isoformat(), "lastUsedAt": s["last_used_at"].isoformat()}
            for s in sessions
        ],
        "family": None
        if m is None
        else {"id": str(m["family_id"]), "role": m["role"], "status": m["status"], "joinedAt": m["joined_at"].isoformat()},
    }


@router.delete("/me", status_code=204)
def delete_account(user: Me = Depends(current_user)) -> Response:
    """Leaves the family (admin handed over, empty family deleted), then deletes the account and all sessions."""
    with db.pool().connection() as conn:
        m = membership(conn, user.id)
        if m is not None:
            remove_member(conn, m["family_id"], user.id)
        conn.execute("DELETE FROM users WHERE id = %s", (user.id,))
        conn.execute("DELETE FROM login_codes WHERE email = %s", (user.email,))
    return Response(status_code=204)
