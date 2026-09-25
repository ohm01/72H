import uuid

import pytest
from fastapi.testclient import TestClient

from app import mailer, maps, settings
from app.geo import BBox
from app.main import app

DEVICE = str(uuid.uuid4())
client = TestClient(app, headers={"X-Device-Id": DEVICE})

# ~2.9 x 3.3 km in Prague
PRAGUE = {"west": 14.40, "south": 50.07, "east": 14.44, "north": 50.10}


@pytest.fixture(autouse=True)
def tmp_extracts(clean_db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "EXTRACTS_DIR", tmp_path)
    calls = []

    async def fake_extract(bbox, out):
        calls.append(bbox)
        out.write_bytes(b"PMTiles" + b"\0" * 100)

    monkeypatch.setattr(maps, "run_extract", fake_extract)
    return calls


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_area_km2():
    area = BBox(**PRAGUE).area_km2()
    assert 9 < area < 10.5


def test_extract_and_download(tmp_extracts):
    r = client.post("/v1/maps/extracts", json=PRAGUE)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sizeBytes"] == 107
    d = client.get(body["url"])
    assert d.status_code == 200
    assert d.content.startswith(b"PMTiles")
    # Range requests work (resumable download)
    part = client.get(body["url"], headers={"Range": "bytes=0-6"})
    assert part.status_code == 206 and part.content == b"PMTiles"


def test_extract_is_cached(tmp_extracts):
    client.post("/v1/maps/extracts", json=PRAGUE)
    client.post("/v1/maps/extracts", json=PRAGUE)
    assert len(tmp_extracts) == 1


def test_rejects_outside_cz():
    r = client.post("/v1/maps/extracts", json={"west": 16.3, "south": 48.1, "east": 16.4, "north": 48.2})  # Vienna
    assert r.status_code == 422


def test_rejects_too_large_for_free():
    r = client.post("/v1/maps/extracts", json={"west": 14.2, "south": 49.9, "east": 14.8, "north": 50.3})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "area_limit"


def test_rejects_invalid_bbox():
    r = client.post("/v1/maps/extracts", json={**PRAGUE, "west": 14.5})
    assert r.status_code == 422


def test_download_rejects_bad_ids():
    assert client.get("/v1/maps/extracts/..%2F..%2Fetc%2Fpasswd").status_code == 404
    assert client.get("/v1/maps/extracts/" + "0" * 32).status_code == 404


def test_requires_device_id_or_account():
    anon = TestClient(app)
    assert anon.post("/v1/maps/extracts", json=PRAGUE).status_code == 401
    assert TestClient(app, headers={"X-Device-Id": "not-a-uuid"}).post("/v1/maps/extracts", json=PRAGUE).status_code == 401
    assert TestClient(app, headers={"Authorization": "Bearer nope"}).post("/v1/maps/extracts", json=PRAGUE).status_code == 401


def area(i: int) -> dict:
    """Distinct small areas in Prague."""
    return {**PRAGUE, "west": PRAGUE["west"] + i * 0.001, "east": PRAGUE["east"] + i * 0.001}


def test_monthly_download_limit_per_device():
    limit = settings.TIERS["limits"]["free"]["mapDownloadsPerMonth"]
    for i in range(limit):
        assert client.post("/v1/maps/extracts", json=area(i)).status_code == 200
    # Retrying an area already downloaded this month is free (e.g. after a failed download).
    assert client.post("/v1/maps/extracts", json=area(0)).status_code == 200
    r = client.post("/v1/maps/extracts", json=area(limit))
    assert r.status_code == 403 and r.json()["detail"] == {"code": "download_limit", "max": limit}
    # Another device has its own limit.
    other = TestClient(app, headers={"X-Device-Id": str(uuid.uuid4())})
    assert other.post("/v1/maps/extracts", json=area(limit)).status_code == 200


def test_signed_in_account_counts_per_account(monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "send", lambda to, subject, text: sent.append(subject))
    client.post("/v1/auth/email/start", json={"email": "a@b.cz"})
    token = client.post("/v1/auth/email/verify", json={"email": "a@b.cz", "code": sent[-1].split(": ")[-1]}).json()["token"]
    user = TestClient(app, headers={"Authorization": f"Bearer {token}"})
    limit = settings.TIERS["limits"]["free"]["mapDownloadsPerMonth"]
    for i in range(limit):
        assert user.post("/v1/maps/extracts", json=area(i)).status_code == 200
    assert user.post("/v1/maps/extracts", json=area(limit)).status_code == 403


def test_global_hourly_cap(monkeypatch):
    monkeypatch.setattr(settings, "MAP_DOWNLOADS_TOTAL_HOUR", 1)
    assert client.post("/v1/maps/extracts", json=area(0)).status_code == 200
    other = TestClient(app, headers={"X-Device-Id": str(uuid.uuid4())})
    r = other.post("/v1/maps/extracts", json=area(1))
    assert r.status_code == 429 and r.json()["detail"]["code"] == "busy"


def test_map_assets(tmp_path, monkeypatch):
    (tmp_path / "fonts" / "Noto Sans Regular").mkdir(parents=True)
    (tmp_path / "fonts" / "Noto Sans Regular" / "0-255.pbf").write_bytes(b"glyphs")
    (tmp_path / "manifest.json").write_text("{}")
    monkeypatch.setattr(settings, "MAP_ASSETS_DIR", tmp_path)
    assert client.get("/v1/maps/assets/manifest.json").status_code == 200
    r = client.get("/v1/maps/assets/fonts/Noto%20Sans%20Regular/0-255.pbf")
    assert r.status_code == 200 and r.content == b"glyphs"
    assert client.get("/v1/maps/assets/../settings.py").status_code == 404
    assert client.get("/v1/maps/assets/%2E%2E/%2E%2E/etc/passwd").status_code == 404
    assert client.get("/v1/maps/assets/fonts").status_code == 404
    assert TestClient(app).get("/v1/maps/assets/manifest.json").status_code == 401


def test_old_download_records_are_deleted():
    from app import db

    with db.pool().connection() as conn:
        conn.execute(
            "INSERT INTO map_downloads (subject, extract_id, created_at) VALUES ('device:x', 'old', now() - interval '90 days')"
        )
    assert client.post("/v1/maps/extracts", json=PRAGUE).status_code == 200
    with db.pool().connection() as conn:
        assert conn.execute("SELECT count(*) AS n FROM map_downloads WHERE extract_id = 'old'").fetchone()["n"] == 0
