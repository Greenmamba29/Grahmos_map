#!/usr/bin/env bash
# Generate offline PMTiles from an OpenStreetMap extract.
# Usage: ./scripts/make-pmtiles.sh <region-url-or-pbf> <minLng,minLat,maxLng,maxLat>
# Example:
#   ./scripts/make-pmtiles.sh \
#     https://download.geofabrik.de/north-america/us/california-latest.osm.pbf \
#     -122.75,37.20,-121.75,38.05
set -euo pipefail

SRC="${1:?Usage: make-pmtiles.sh <osm-pbf-url-or-path> <bbox>}"
BBOX="${2:?bbox required: minLng,minLat,maxLng,maxLat}"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/tiles"
mkdir -p "$OUT_DIR"

# 1. Fetch the OSM extract if a URL was given
if [[ "$SRC" == http* ]]; then
  PBF="/tmp/$(basename "$SRC")"
  [[ -f "$PBF" ]] || curl -L -o "$PBF" "$SRC"
else
  PBF="$SRC"
fi

# 2. Fetch Planetiler (requires Java 21+)
JAR=/tmp/planetiler.jar
[[ -f "$JAR" ]] || curl -L -o "$JAR" \
  https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar

# 3. Build the basemap vector tiles clipped to the bbox
java -Xmx4g -jar "$JAR" \
  --osm-path="$PBF" \
  --output="$OUT_DIR/region.pmtiles" \
  --bounds="$BBOX" \
  --maxzoom=14 \
  --force

# 4. Terrain DEM (optional; requires the go-pmtiles CLI: `pmtiles`)
if command -v pmtiles >/dev/null 2>&1; then
  pmtiles extract https://build.protomaps.com/terrain.pmtiles \
    "$OUT_DIR/terrain.pmtiles" --bbox="$BBOX" || \
    echo "WARN: terrain extract failed — hillshade will use online fallback"
else
  echo "NOTE: install go-pmtiles to also extract terrain DEM tiles"
fi

echo
echo "Done. Set in .env:"
echo "  VITE_BASEMAP_PMTILES_URL=/tiles/region.pmtiles"
[[ -f "$OUT_DIR/terrain.pmtiles" ]] && echo "  VITE_TERRAIN_PMTILES_URL=/tiles/terrain.pmtiles"
