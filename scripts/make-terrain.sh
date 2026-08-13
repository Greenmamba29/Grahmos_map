#!/usr/bin/env bash
# DEM GeoTIFF → Terrain-RGB tiles → public/tiles/terrain.pmtiles
#
# Usage:
#   ./scripts/make-terrain.sh --dem path/to/dem.tif --out public/tiles/terrain.pmtiles
set -euo pipefail

DEM=""
OUT="public/tiles/terrain.pmtiles"
MINZOOM=6
MAXZOOM=12
WORKDIR="${TMPDIR:-/tmp}/resilience-terrain-$$"

usage() {
  sed -n '2,6p' "$0"
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dem)     DEM="$2"; shift 2 ;;
    --out)     OUT="$2"; shift 2 ;;
    --minzoom) MINZOOM="$2"; shift 2 ;;
    --maxzoom) MAXZOOM="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

if [[ -z "$DEM" || ! -f "$DEM" ]]; then
  echo "Pass --dem <geotiff>." >&2
  usage 1
fi

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    echo "See INSTALLATION_GUIDE.md §8." >&2
    exit 1
  fi
}

need gdalwarp
need gdal2tiles.py
need pmtiles
if ! command -v rio >/dev/null 2>&1; then
  echo "Missing rio (rasterio). Install with: pip install rasterio rio-rgbify" >&2
  exit 1
fi

mkdir -p "$WORKDIR" "$(dirname "$OUT")"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Reprojecting DEM to Web Mercator"
gdalwarp -t_srs EPSG:3857 -r bilinear -of GTiff "$DEM" "$WORKDIR/dem-3857.tif"

echo "Encoding Terrain-RGB (Mapbox encoding, -10000 offset, 0.1 interval)"
rio rgbify -b -10000 -i 0.1 "$WORKDIR/dem-3857.tif" "$WORKDIR/terrain-rgb.tif"

echo "Cutting tiles z${MINZOOM}–${MAXZOOM}"
gdal2tiles.py --profile=mercator --zoom="${MINZOOM}-${MAXZOOM}" -w none \
  "$WORKDIR/terrain-rgb.tif" "$WORKDIR/tiles"

# Pack the XYZ directory. `pmtiles convert` accepts an MBTiles file; build one
# with gdal if available, otherwise require the user to pre-convert.
if command -v python3 >/dev/null 2>&1; then
  python3 - "$WORKDIR/tiles" "$WORKDIR/terrain.mbtiles" "$MINZOOM" "$MAXZOOM" <<'PY'
import sqlite3, sys, os, hashlib
from pathlib import Path

root, out, minz, maxz = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
if os.path.exists(out):
    os.remove(out)
db = sqlite3.connect(out)
db.execute("""CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)""")
db.execute("""CREATE TABLE metadata (name TEXT, value TEXT)""")
db.execute("""CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)""")
count = 0
for png in root.rglob("*.png"):
    # gdal2tiles layout: {z}/{x}/{y}.png with TMS y
    z, x, y = (int(png.parent.parent.name), int(png.parent.name), int(png.stem))
    db.execute("INSERT OR REPLACE INTO tiles VALUES (?,?,?,?)", (z, x, y, png.read_bytes()))
    count += 1
db.executemany("INSERT INTO metadata VALUES (?,?)", [
    ("name", "terrain-rgb"),
    ("format", "png"),
    ("minzoom", str(minz)),
    ("maxzoom", str(maxz)),
    ("encoding", "mapbox"),
])
db.commit()
print(f"Packed {count} tiles into {out}")
PY
  pmtiles convert "$WORKDIR/terrain.mbtiles" "$OUT"
else
  echo "python3 is required to pack gdal2tiles output." >&2
  exit 1
fi

pmtiles show "$OUT" || true
echo
echo "Wrote $OUT"
