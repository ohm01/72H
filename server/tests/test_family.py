import base64
import uuid

import pytest
from fastapi.testclient import TestClient

from app import db, mailer, settings
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def outbox(clean_db, monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "send", lambda to, subject, text: sent.append(subject))
    return sent


@pytest.fixture
def login(outbox):
    def _login(email: str) -> dict:
        client.post("/v1/auth/email/start", json={"email": email})
        code = outbox[-1].split(": ")[-1]
        token = client.post("/v1/auth/email/verify", json={"email": email, "code": code}).json()["token"]
        return {"Authorization": f"Bearer {token}"}

    return _login


def invite(headers) -> dict:
    r = client.post("/v1/family/invites", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def record(type_="items", updated=1000, text=b"secret") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "type": type_,
        "updatedAt": updated,
        "nonce": base64.b64encode(b"n" * 24).decode(),
        "ciphertext": base64.b64encode(text).decode(),
    }


def family_of(parent, child):
    """Parent creates a family, child joins with an invite and gets approved."""
    assert client.post("/v1/families", headers=parent).status_code == 200
    inv = invite(parent)
    joined = client.post("/v1/families/join", headers=child, json={"familyId": inv["familyId"], "token": inv["token"]}).json()
    child_id = next(m["userId"] for m in joined["members"] if m["status"] == "pending")
    assert client.post(f"/v1/family/members/{child_id}/approve", headers=parent).status_code == 204
    return inv["familyId"], child_id


def test_family_invite_join_approve(login):
    parent, child = login("mama@example.cz"), login("dite@example.cz")
    family_of(parent, child)
    fam = client.get("/v1/family", headers=child).json()
    assert [(m["email"], m["role"], m["status"]) for m in fam["members"]] == [
        ("mama@example.cz", "admin", "active"),
        ("dite@example.cz", "member", "active"),
    ]


def test_invite_is_single_use_and_expires(login):
    parent = login("mama@example.cz")
    client.post("/v1/families", headers=parent)
    inv = invite(parent)
    body = {"familyId": inv["familyId"], "token": inv["token"]}
    assert client.post("/v1/families/join", headers=login("a@example.cz"), json=body).status_code == 200
    r = client.post("/v1/families/join", headers=login("b@example.cz"), json=body)
    assert r.status_code == 400 and r.json()["detail"]["code"] == "invite_invalid"

    inv2 = invite(parent)
    with db.pool().connection() as conn:
        conn.execute("UPDATE invites SET expires_at = now() - interval '1 second' WHERE used_at IS NULL")
    r = client.post("/v1/families/join", headers=login("c@example.cz"), json={"familyId": inv2["familyId"], "token": inv2["token"]})
    assert r.json()["detail"]["code"] == "invite_invalid"


def test_pending_member_cannot_sync(login):
    parent, stranger = login("mama@example.cz"), login("cizi@example.cz")
    client.post("/v1/families", headers=parent)
    inv = invite(parent)
    client.post("/v1/families/join", headers=stranger, json={"familyId": inv["familyId"], "token": inv["token"]})
    assert client.post("/v1/sync/push", headers=parent, json={"records": [record()]}).status_code == 200
    r = client.get("/v1/sync/pull", headers=stranger)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "not_active_member"


def test_only_admin_invites_and_approves(login):
    parent, child = login("mama@example.cz"), login("dite@example.cz")
    _, child_id = family_of(parent, child)
    assert client.post("/v1/family/invites", headers=child).status_code == 403
    assert client.post(f"/v1/family/members/{child_id}/approve", headers=child).status_code == 403


def test_member_limit(login):
    parent = login("mama@example.cz")
    client.post("/v1/families", headers=parent)
    for i in range(settings.TIERS["limits"]["free"]["familyMembers"] - 1):
        inv = invite(parent)
        client.post("/v1/families/join", headers=login(f"m{i}@example.cz"), json={"familyId": inv["familyId"], "token": inv["token"]})
    r = client.post("/v1/family/invites", headers=parent)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "member_limit"


def test_sync_last_write_wins_and_cursor(login):
    parent, child = login("mama@example.cz"), login("dite@example.cz")
    family_of(parent, child)
    rec = record(updated=1000, text=b"v1")
    client.post("/v1/sync/push", headers=parent, json={"records": [rec]})
    first = client.get("/v1/sync/pull", headers=child).json()
    assert len(first["records"]) == 1 and base64.b64decode(first["records"][0]["ciphertext"]) == b"v1"

    # Older write is ignored, newer wins and shows up after the cursor.
    old = {**rec, "updatedAt": 500, "ciphertext": base64.b64encode(b"old").decode()}
    new = {**rec, "updatedAt": 2000, "ciphertext": base64.b64encode(b"v2").decode()}
    assert client.post("/v1/sync/push", headers=child, json={"records": [old]}).json()["applied"] == 0
    assert client.post("/v1/sync/push", headers=child, json={"records": [new]}).json()["applied"] == 1
    later = client.get(f"/v1/sync/pull?since={first['cursor']}", headers=parent).json()
    assert [base64.b64decode(r["ciphertext"]) for r in later["records"]] == [b"v2"]
    assert client.get(f"/v1/sync/pull?since={later['cursor']}", headers=parent).json()["records"] == []


def test_sync_rejects_unknown_types(login):
    parent = login("mama@example.cz")
    client.post("/v1/families", headers=parent)
    r = client.post("/v1/sync/push", headers=parent, json={"records": [record(type_="passwords")]})
    assert r.status_code == 422


def test_families_do_not_see_each_other(login):
    a, b = login("a@example.cz"), login("b@example.cz")
    client.post("/v1/families", headers=a)
    client.post("/v1/families", headers=b)
    client.post("/v1/sync/push", headers=a, json={"records": [record()]})
    assert client.get("/v1/sync/pull", headers=b).json()["records"] == []


def test_removed_member_loses_access_and_location(login):
    parent, child = login("mama@example.cz"), login("dite@example.cz")
    _, child_id = family_of(parent, child)
    loc = {**record(type_="last_location"), "id": child_id}
    client.post("/v1/sync/push", headers=child, json={"records": [loc]})
    assert client.delete(f"/v1/family/members/{child_id}", headers=parent).status_code == 204
    assert client.get("/v1/sync/pull", headers=child).status_code == 403
    assert client.get("/v1/sync/pull", headers=parent).json()["records"] == []


def test_admin_leaving_hands_over_and_last_member_deletes_family(login):
    parent, child = login("mama@example.cz"), login("dite@example.cz")
    family_of(parent, child)
    assert client.delete("/v1/family/members/me", headers=parent).status_code == 204
    fam = client.get("/v1/family", headers=child).json()
    assert [(m["email"], m["role"]) for m in fam["members"]] == [("dite@example.cz", "admin")]
    client.delete("/v1/family/members/me", headers=child)
    with db.pool().connection() as conn:
        assert conn.execute("SELECT count(*) AS n FROM families").fetchone()["n"] == 0


def test_export_and_delete_account(login):
    parent, child = login("mama@example.cz"), login("dite@example.cz")
    family_of(parent, child)
    data = client.get("/v1/me/export", headers=parent).json()
    assert data["account"]["email"] == "mama@example.cz" and data["family"]["role"] == "admin"

    assert client.delete("/v1/me", headers=parent).status_code == 204
    assert client.get("/v1/me", headers=parent).status_code == 401
    fam = client.get("/v1/family", headers=child).json()
    assert [(m["email"], m["role"]) for m in fam["members"]] == [("dite@example.cz", "admin")]


def test_join_page_passes_fragment_to_the_app():
    r = client.get("/join")
    assert r.status_code == 200 and 'app72h://join" + location.hash' in r.text
