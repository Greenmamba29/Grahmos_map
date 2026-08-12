#!/usr/bin/env bash
# Generate a regional PMTiles archive from an OSM extract.
# Requires: wget/curl, osmium (optional), java + planetiler.jar OR tilemaker + pmtiles CLI
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${ROOT}/data"
OUT_DIR="${ROOT}/public/tiles"
AREA="${AREA:-north-america/us/colorado}"
BBOX="${BBOX:--105.6,39.5,-104.6,40.2}"
NAME="${NAME:-denver}"

mkdir -p "$DATA_DIR" "$OUT_DIR"

EXTRACT_URL="https://download.geofabrik.de/${AREA}-latest.osm.pbf"
EXTRACT_FILE="${DATA_DIR}/$(basename "$EXTRACT_URL")"

if [[ ! -f "$EXTRACT_FILE" ]]; then
  echo "Downloading ${EXTRACT_URL}"
  curl -L "$EXTRACT_URL" -o "$EXTRACT_FILE"
fi

CLIPPED="${DATA_DIR}/${NAME}.osm.pbf"
if command -v osmium >/dev/null 2>&1; then
  echo "Clipping to ${BBOX}"
  osmium extract -b "$BBOX" "$EXTRACT_FILE" -o "$CLIPPED" --overwrite
else
  echo "osmium not found — using full extract (install osmium-tool to clip)"
  CLIPPED="$EXTRACT_FILE"
fi

PLANETILER_JAR="${PLANETILER_JAR:-${DATA_DIR}/planetiler.jar}"
if [[ -f "$PLANETILER_JAR" ]]; then
  echo "Building PMTiles with Planetiler…"
  java -Xmx4g -jar "$PLANETILER_JAR" \
    --osm-path="$CLIPPED" \
    --output="${OUT_DIR}/${NAME}.pmtiles" \
    --bounds="$BBOX" \
    --download=true
  echo "Wrote ${OUT_DIR}/${NAME}.pmtiles"
  exit 0
fi

cat <<EOF
Planetiler JAR not found at ${PLANETILER_JAR}.

Next steps:
  1. Download Planetiler: https://github.com/onthegomap/planetiler/releases
  2. Place planetiler.jar in ${DATA_DIR}/ (or set PLANETILER_JAR)
  3. Re-run: AREA=... BBOX=... NAME=... ./scripts/generate-pmtiles.sh

Alternatively use tilemaker → MBTiles, then: pmtiles convert region.mbtiles ${OUT_DIR}/${NAME}.pmtiles
EOF
exit 1
