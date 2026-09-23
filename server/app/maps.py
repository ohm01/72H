"""Offline map extracts: the app sends a rectangle, the server cuts it from the CZ PMTiles file."""

import asyncio
import hashlib
import logging
import time
from pathlib import Path

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import settings
from .geo import CZ_BBOX, BBox

log = logging.getLogger(__name__)


def require_dev_key(x_dev_key: str = Header(default="")) -> None:
    # TODO(M3): replace with user authentication.
    if not settings.DEV_API_KEY or not hmac.compare_digest(x_dev_key, settings.DEV_API_KEY):
        raise HTTPException(401)


router = APIRouter(prefix="/v1/maps", tags=["maps"], dependencies=[Depends(require_dev_key)])

# The RPi is small: cut one extract at a time.
_extract_lock = asyncio.Semaphore(1)


class ExtractRequest(BaseModel):
    west: float = Field(ge=-180, le=180)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    north: float = Field(ge=-90, le=90)


class ExtractResponse(BaseModel):
    id: str
    areaKm2: float
    sizeBytes: int
    url: str


def extract_id(bbox: BBox) -> str:
    raw = f"{bbox.key()}|z{settings.EXTRACT_MAXZOOM}|{settings.MAP_SOURCE}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def extract_path(extract_id_: str) -> Path:
    return settings.EXTRACTS_DIR / f"{extract_id_}.pmtiles"


async def run_extract(bbox: BBox, out: Path) -> None:
    """Runs the pmtiles CLI. Separate function so tests can replace it."""
    tmp = out.with_suffix(".part")
    proc = await asyncio.create_subprocess_exec(
        "pmtiles",
        "extract",
        settings.MAP_SOURCE,
        str(tmp),
        f"--bbox={bbox.west},{bbox.south},{bbox.east},{bbox.north}",
        f"--maxzoom={settings.EXTRACT_MAXZOOM}",
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=settings.EXTRACT_TIMEOUT_S)
    except asyncio.TimeoutError:
        proc.kill()
        tmp.unlink(missing_ok=True)
        raise HTTPException(504, "extract timed out")
    if proc.returncode != 0:
        tmp.unlink(missing_ok=True)
        log.error("pmtiles extract failed: %s", stderr.decode(errors="replace")[-500:])
        raise HTTPException(502, "extract failed")
    tmp.rename(out)


def cleanup_old_extracts() -> None:
    cutoff = time.time() - settings.EXTRACT_CACHE_HOURS * 3600
    for f in settings.EXTRACTS_DIR.glob("*.pmtiles"):
        if f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)


@router.post("/extracts", response_model=ExtractResponse)
async def create_extract(req: ExtractRequest) -> ExtractResponse:
    bbox = BBox(req.west, req.south, req.east, req.north)
    if not bbox.is_valid():
        raise HTTPException(422, "invalid bbox")
    if not bbox.within(CZ_BBOX):
        raise HTTPException(422, "area outside supported region (CZ)")

    # TODO(M3/M4): take tier + monthly download count from the authenticated user.
    limits = settings.TIERS["limits"]["free"]
    area = bbox.area_km2()
    if area > limits["mapAreaMaxKm2"]:
        raise HTTPException(
            403, {"code": "area_limit", "areaKm2": round(area, 1), "maxKm2": limits["mapAreaMaxKm2"]}
        )

    settings.EXTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    eid = extract_id(bbox)
    out = extract_path(eid)
    async with _extract_lock:
        cleanup_old_extracts()
        if not out.exists():
            await run_extract(bbox, out)

    return ExtractResponse(id=eid, areaKm2=round(area, 1), sizeBytes=out.stat().st_size, url=f"/v1/maps/extracts/{eid}")


@router.get("/extracts/{eid}")
def download_extract(eid: str) -> FileResponse:
    # Only hex ids: no path traversal.
    if len(eid) != 32 or any(c not in "0123456789abcdef" for c in eid):
        raise HTTPException(404)
    path = extract_path(eid)
    if not path.exists():
        raise HTTPException(404)
    # FileResponse supports HTTP Range, so the app can resume and show progress.
    return FileResponse(path, media_type="application/vnd.pmtiles", filename=f"72h-{eid[:8]}.pmtiles")


@router.get("/assets/{path:path}")
def map_asset(path: str) -> FileResponse:
    """Fonts and sprites listed in manifest.json; the app caches them for offline use."""
    root = settings.MAP_ASSETS_DIR.resolve()
    target = (root / path).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise HTTPException(404)
    return FileResponse(target)
