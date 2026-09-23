import json
import os
from pathlib import Path

# Map source: local CZ file (after SSD move) or a remote Protomaps build URL.
MAP_SOURCE = os.environ.get("MAP_SOURCE", "/maps/cz.pmtiles")
# Where extracts are cached (inside the project's var/ on the host).
EXTRACTS_DIR = Path(os.environ.get("EXTRACTS_DIR", "/data/extracts"))
EXTRACT_MAXZOOM = int(os.environ.get("EXTRACT_MAXZOOM", "15"))
EXTRACT_TIMEOUT_S = int(os.environ.get("EXTRACT_TIMEOUT_S", "600"))
EXTRACT_CACHE_HOURS = int(os.environ.get("EXTRACT_CACHE_HOURS", "24"))
# Fonts + sprites for offline maps (scripts/fetch-map-assets.sh), served to the app.
MAP_ASSETS_DIR = Path(os.environ.get("MAP_ASSETS_DIR", "/maps/assets"))

# Temporary guard until user auth exists (M3): map endpoints need X-Dev-Key.
DEV_API_KEY = os.environ.get("DEV_API_KEY", "")

TIERS_PATH = Path(os.environ.get("TIERS_PATH", Path(__file__).resolve().parent.parent / "config" / "tiers.json"))


def load_tiers() -> dict:
    return json.loads(TIERS_PATH.read_text(encoding="utf-8"))


TIERS = load_tiers()
