#!/usr/bin/env bash
# OSM extract → (planetiler | tilemaker) → public/tiles/region.pmtiles
#
# Usage:
#   ./scripts/make-pmtiles.sh \
#     --pbf-url https://download.geofabrik.de/central-america/haiti-and-domrep-latest.osm.pbf \
#     --bbox -72.65,18.40,-72.10,18.70 \
#     --out public/tiles/region.pmtiles
set -euo pipefail

PBF_URL=""
PBF_PATH=""
BBOX=""
OUT="public/tiles/region.pmtiles"
MINZOOM=0
MAXZOOM=14
WORKDIR="${TMPDIR:-/tmp}/resilience-pmtiles-$$"

usage() {
  sed -n '2,11p' "$0"
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pbf-url) PBF_URL="$2"; shift 2 ;;
    --pbf)     PBF_PATH="$2"; shift 2 ;;
    --bbox)    BBOX="$2"; shift 2 ;;
    --out)     OUT="$2"; shift 2 ;;
    --minzoom) MINZOOM="$2"; shift 2 ;;
    --maxzoom) MAXZOOM="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    echo "See INSTALLATION_GUIDE.md §7 for install instructions." >&2
    exit 1
  fi
}

mkdir -p "$WORKDIR" "$(dirname "$OUT")"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ -z "$PBF_PATH" ]]; then
  if [[ -z "$PBF_URL" ]]; then
    echo "Pass --pbf <file> or --pbf-url <url>." >&2
    usage 1
  fi
  need curl
  PBF_PATH="$WORKDIR/source.osm.pbf"
  echo "Downloading $PBF_URL"
  curl -L --fail --retry 3 -o "$PBF_PATH" "$PBF_URL"
fi

EXTRACT="$PBF_PATH"
if [[ -n "$BBOX" ]]; then
  need osmium
  EXTRACT="$WORKDIR/aoi.osm.pbf"
  echo "Clipping to $BBOX"
  osmium extract --bbox="$BBOX" --set-bounds -o "$EXTRACT" "$PBF_PATH"
fi

if command -v java >/dev/null 2>&1 && [[ -n "${PLANETILER_JAR:-}" && -f "${PLANETILER_JAR}" ]]; then
  echo "Building PMTiles with planetiler"
  java -Xmx"${PLANETILER_XMX:-8g}" -jar "$PLANETILER_JAR" \
    --osm-path="$EXTRACT" \
    --output="$OUT" \
    --force \
    --minzoom="$MINZOOM" \
    --maxzoom="$MAXZOOM"
elif command -v tilemaker >/dev/null 2>&1 && command -v pmtiles >/dev/null 2>&1; then
  echo "Building MBTiles with tilemaker, then converting"
  MBTILES="$WORKDIR/region.mbtiles"
  tilemaker --input "$EXTRACT" --output "$MBTILES"
  pmtiles convert "$MBTILES" "$OUT"
else
  cat >&2 <<'EOF'
No tile builder found.

Install one of:
  - planetiler: download planetiler.jar and set PLANETILER_JAR
  - tilemaker + pmtiles (see INSTALLATION_GUIDE.md §7)

Until an archive exists the app uses the online raster fallback.
EOF
  exit 1
fi

if command -v pmtiles >/dev/null 2>&1; then
  echo
  pmtiles show "$OUT"
fi

echo
echo "Wrote $OUT"
echo "Serve with Accept-Ranges: bytes (see deploy/nginx.conf)."
