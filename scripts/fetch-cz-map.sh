#!/usr/bin/env bash
# Cuts the Czech Republic out of the latest Protomaps world build into maps/cz.pmtiles (run on the server),
# then fetches the fonts/sprites. Usage: scripts/fetch-cz-map.sh [YYYYMMDD]
# BBOX=west,south,east,north overrides the area (e.g. a small test cut).
set -euo pipefail
cd "$(dirname "$0")/.."
BUILD=${1:-$(curl -fsS https://build-metadata.protomaps.dev/builds.json | python3 -c 'import json,sys; print(json.load(sys.stdin)[-1]["key"].removesuffix(".pmtiles"))')}
BBOX=${BBOX:-12.09,48.55,18.86,51.06}  # = CZ_BBOX in server/app/geo.py
OUT=${OUT:-maps/cz.pmtiles}
mkdir -p "$(dirname "$OUT")"
OUT_DIR=$(cd "$(dirname "$OUT")" && pwd)
echo "Build $BUILD, bbox $BBOX -> $OUT"
# pmtiles CLI from the API image (same version the server uses).
docker run --rm -v "$OUT_DIR:/out" --entrypoint pmtiles "$(basename "$PWD")-api" \
  extract "https://build.protomaps.com/$BUILD.pmtiles" "/out/$(basename "$OUT").part" --bbox="$BBOX" --maxzoom=15
mv "$OUT.part" "$OUT"
ls -lh "$OUT"
[ -n "${SKIP_ASSETS:-}" ] || scripts/fetch-map-assets.sh
echo "Done. MAP_SOURCE=/maps/cz.pmtiles in .env, then: docker compose up -d"
