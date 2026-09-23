#!/usr/bin/env bash
# Downloads the small set of map fonts (glyphs) and sprites the app needs offline
# into maps/assets and writes a manifest. Source: github.com/protomaps/basemaps-assets (OFL / CC0).
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=https://raw.githubusercontent.com/protomaps/basemaps-assets/main
OUT=maps/assets
FONTS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")
# Basic Latin, Latin-1, Latin Extended-A/B (Czech/Slovak/Polish/Finnish), General Punctuation.
RANGES=("0-255" "256-511" "512-767" "8192-8447")
SPRITES=(light light@2x dark dark@2x)

mkdir -p "$OUT/sprites"
files=()
for f in "${FONTS[@]}"; do
  mkdir -p "$OUT/fonts/$f"
  for r in "${RANGES[@]}"; do
    curl -fsSL "$BASE/fonts/${f// /%20}/$r.pbf" -o "$OUT/fonts/$f/$r.pbf"
    files+=("fonts/$f/$r.pbf")
  done
done
for s in "${SPRITES[@]}"; do
  for ext in json png; do
    curl -fsSL "$BASE/sprites/v4/$s.$ext" -o "$OUT/sprites/$s.$ext"
    files+=("sprites/$s.$ext")
  done
done
curl -fsSL "$BASE/fonts/OFL.txt" -o "$OUT/fonts/OFL.txt"

python3 - "$OUT" "${files[@]}" <<'PY'
import json, os, sys
out, files = sys.argv[1], sys.argv[2:]
manifest = {"version": 1, "files": [{"path": f, "size": os.path.getsize(os.path.join(out, f))} for f in files]}
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)
print(len(files), "files,", sum(x["size"] for x in manifest["files"]) // 1024, "KiB")
PY
