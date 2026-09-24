import pytest
from fastapi.testclient import TestClient

from app import db, mailer, settings
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def outbox(clean_db, monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "send", lambda to, subject, text: sent.append((to, subject, text)))
    return sent


def code_from(outbox) -> str:
    return outbox[-1][1].split(": ")[-1]


def login(outbox, email="Jana@Example.cz") -> dict:
    assert client.post("/v1/auth/email/start", json={"email": email, "lang": "cs"}).status_code == 204
    r = client.post("/v1/auth/email/verify", json={"email": email, "code": code_from(outbox), "deviceName": "iPhone"})
    assert r.status_code == 200, r.text
    return r.json()


def test_login_with_code_creates_account_and_session(outbox):
    session = login(outbox)
    assert session["email"] == "jana@example.cz"
    to, subject, text = outbox[0]
    assert to == "jana@example.cz" and subject.startswith("Přihlašovací kód 72h: ")
    me = client.get("/v1/me", headers={"Authorization": f"Bearer {session['token']}"})
    assert me.status_code == 200 and me.json()["email"] == "jana@example.cz"


def test_second_login_reuses_the_account(outbox):
    first = login(outbox)
    second = login(outbox, "jana@example.cz ")
    assert first["userId"] == second["userId"] and first["token"] != second["token"]


def test_code_is_single_use(outbox):
    login(outbox)
    r = client.post("/v1/auth/email/verify", json={"email": "jana@example.cz", "code": code_from(outbox)})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "code_expired"


def test_wrong_code_attempts_are_limited(outbox):
    client.post("/v1/auth/email/start", json={"email": "a@b.cz"})
    good = code_from(outbox)
    bad = "000000" if good != "000000" else "111111"
    for _ in range(settings.LOGIN_CODE_MAX_ATTEMPTS):
        r = client.post("/v1/auth/email/verify", json={"email": "a@b.cz", "code": bad})
        assert r.json()["detail"]["code"] == "wrong_code"
    # Even the right code no longer works: the attempt counter survived the error responses.
    r = client.post("/v1/auth/email/verify", json={"email": "a@b.cz", "code": good})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "code_expired"


def test_expired_code_is_rejected(outbox):
    client.post("/v1/auth/email/start", json={"email": "a@b.cz"})
    with db.pool().connection() as conn:
        conn.execute("UPDATE login_codes SET expires_at = now() - interval '1 second'")
    r = client.post("/v1/auth/email/verify", json={"email": "a@b.cz", "code": code_from(outbox)})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "code_expired"


def test_codes_per_email_are_rate_limited(outbox):
    for _ in range(settings.LOGIN_CODES_PER_EMAIL_HOUR):
        assert client.post("/v1/auth/email/start", json={"email": "a@b.cz"}).status_code == 204
    r = client.post("/v1/auth/email/start", json={"email": "a@b.cz"})
    assert r.status_code == 429
    assert len(outbox) == settings.LOGIN_CODES_PER_EMAIL_HOUR


def test_invalid_email_is_rejected():
    assert client.post("/v1/auth/email/start", json={"email": "not-an-email"}).status_code == 422


def test_codes_are_stored_hashed(outbox):
    client.post("/v1/auth/email/start", json={"email": "a@b.cz"})
    with db.pool().connection() as conn:
        stored = bytes(conn.execute("SELECT code_hash FROM login_codes").fetchone()["code_hash"])
    assert code_from(outbox).encode() not in stored and len(stored) == 32


def test_logout_revokes_the_token(outbox):
    session = login(outbox)
    headers = {"Authorization": f"Bearer {session['token']}"}
    assert client.post("/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/v1/me", headers=headers).status_code == 401


def test_me_requires_a_valid_token():
    assert client.get("/v1/me").status_code == 401
    assert client.get("/v1/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_email_failure_is_reported(monkeypatch):
    def boom(*_):
        raise RuntimeError("provider down")

    monkeypatch.setattr(mailer, "send", boom)
    r = client.post("/v1/auth/email/start", json={"email": "a@b.cz"})
    assert r.status_code == 502 and r.json()["detail"]["code"] == "email_failed"


def test_login_texts_exist_for_all_app_languages():
    for lang in ("cs", "en", "sk", "pl", "fi"):
        subject, text = mailer.login_message("123456", lang)
        assert "123456" in subject and "123456" in text
