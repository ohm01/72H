import pytest
from fastapi.testclient import TestClient

from app import maps, settings
from app.geo import BBox
from app.main import app

client = TestClient(app, headers={"X-Dev-Key": "test-key"})

# ~2.9 x 3.3 km in Prague
PRAGUE = {"west": 14.40, "south": 50.07, "east": 14.44, "north": 50.10}


@pytest.fixture(autouse=True)
def tmp_extracts(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "EXTRACTS_DIR", tmp_path)
    monkeypatch.setattr(settings, "DEV_API_KEY", "test-key")
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


def test_requires_dev_key():
    anon = TestClient(app)
    assert anon.post("/v1/maps/extracts", json=PRAGUE).status_code == 401
    assert TestClient(app, headers={"X-Dev-Key": "wrong"}).post("/v1/maps/extracts", json=PRAGUE).status_code == 401
