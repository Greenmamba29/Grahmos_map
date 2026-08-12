#!/usr/bin/env bash
# Runs Planetiler against the downloaded OSM extract using the OpenMapTiles
# schema, then converts the resulting MBTiles to a single-file PMTiles
# archive with go-pmtiles. See INSTALLATION_GUIDE.md §4.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLANETILER_JAR="${PLANETILER_JAR:-$ROOT_DIR/data/planetiler.jar}"

if [ ! -f "$PLANETILER_JAR" ]; then
  echo "Planetiler jar not found at $PLANETILER_JAR"
  echo "Download it with: curl -L -o \"$PLANETILER_JAR\" https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar"
  exit 1
fi

mkdir -p "$ROOT_DIR/public/tiles"

echo "Building vector tiles with Planetiler…"
java -Xmx4g -jar "$PLANETILER_JAR" --force \
  --osm-path="$ROOT_DIR/data/osm/region.osm.pbf" \
  --output="$ROOT_DIR/data/osm/streets.mbtiles" \
  --minzoom=0 --maxzoom=14

echo "Converting to PMTiles…"
go-pmtiles convert "$ROOT_DIR/data/osm/streets.mbtiles" "$ROOT_DIR/public/tiles/streets.pmtiles"
go-pmtiles verify "$ROOT_DIR/public/tiles/streets.pmtiles"

echo "Done: $ROOT_DIR/public/tiles/streets.pmtiles"
