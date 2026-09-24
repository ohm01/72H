"""Sync of end-to-end encrypted records. The server stores opaque blobs; last write (updatedAt) wins."""

import base64

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from . import db
from .auth import Me, current_user

router = APIRouter(prefix="/v1", tags=["sync"])

MAX_BATCH = 500
MAX_CIPHERTEXT = 64 * 1024
# App table names; last_location = one record per member (id = user id, M6).
TYPES = {"locations", "items", "meeting_points", "contacts", "checklist_checks", "settings", "last_location"}


class Record(BaseModel):
    id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    type: str
    updatedAt: int = Field(ge=0, description="client clock, ms since epoch")
    deleted: bool = False
    keyVersion: int = Field(default=1, ge=1)
    nonce: str = Field(max_length=64, description="base64")
    ciphertext: str = Field(max_length=MAX_CIPHERTEXT * 4 // 3 + 4, description="base64")


class PushRequest(BaseModel):
    records: list[Record] = Field(max_length=MAX_BATCH)


class PullResponse(BaseModel):
    records: list[Record]
    cursor: int
    more: bool


def active_family(conn, user: Me):
    m = conn.execute("SELECT family_id, status FROM family_members WHERE user_id = %s", (user.id,)).fetchone()
    if m is None or m["status"] != "active":
        raise HTTPException(403, {"code": "not_active_member"})
    return m["family_id"]


def b64(data: str) -> bytes:
    try:
        return base64.b64decode(data, validate=True)
    except ValueError:
        raise HTTPException(422, {"code": "bad_base64"})


@router.post("/sync/push")
def push(req: PushRequest, user: Me = Depends(current_user)) -> dict:
    for r in req.records:
        if r.type not in TYPES:
            raise HTTPException(422, {"code": "bad_type", "type": r.type})
    with db.pool().connection() as conn:
        family_id = active_family(conn, user)
        applied = 0
        for r in req.records:
            # Last write wins; a newer copy already on the server is kept.
            row = conn.execute(
                """INSERT INTO records (family_id, id, type, updated_at, deleted, key_version, nonce, ciphertext)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (family_id, id) DO UPDATE SET
                       type = EXCLUDED.type, updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted,
                       key_version = EXCLUDED.key_version, nonce = EXCLUDED.nonce, ciphertext = EXCLUDED.ciphertext,
                       seq = nextval(pg_get_serial_sequence('records', 'seq'))
                   WHERE records.updated_at < EXCLUDED.updated_at
                   RETURNING seq""",
                (family_id, r.id, r.type, r.updatedAt, r.deleted, r.keyVersion, b64(r.nonce), b64(r.ciphertext)),
            ).fetchone()
            applied += row is not None
    return {"applied": applied}


@router.get("/sync/pull", response_model=PullResponse)
def pull(since: int = Query(default=0, ge=0), user: Me = Depends(current_user)) -> PullResponse:
    with db.pool().connection() as conn:
        family_id = active_family(conn, user)
        rows = conn.execute(
            """SELECT id, type, updated_at, deleted, key_version, nonce, ciphertext, seq FROM records
               WHERE family_id = %s AND seq > %s ORDER BY seq LIMIT %s""",
            (family_id, since, MAX_BATCH + 1),
        ).fetchall()
    more = len(rows) > MAX_BATCH
    rows = rows[:MAX_BATCH]
    return PullResponse(
        records=[
            Record(
                id=str(r["id"]),
                type=r["type"],
                updatedAt=r["updated_at"],
                deleted=r["deleted"],
                keyVersion=r["key_version"],
                nonce=base64.b64encode(r["nonce"]).decode(),
                ciphertext=base64.b64encode(r["ciphertext"]).decode(),
            )
            for r in rows
        ],
        cursor=rows[-1]["seq"] if rows else since,
        more=more,
    )
