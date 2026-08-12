#!/usr/bin/env bash
# Downloads a Geofabrik .osm.pbf regional extract and verifies its checksum.
# See INSTALLATION_GUIDE.md §4 for the full pipeline this script belongs to.
set -euo pipefail

REGION_URL="${1:?Usage: 01_download_osm_extract.sh <geofabrik-pbf-url>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/data/osm"
mkdir -p "$OUT_DIR"

echo "Downloading OSM extract from: $REGION_URL"
curl -L "$REGION_URL" -o "$OUT_DIR/region.osm.pbf"

if curl -fsSL "$REGION_URL.md5" -o "$OUT_DIR/region.osm.pbf.md5" 2>/dev/null; then
  (cd "$OUT_DIR" && md5sum -c region.osm.pbf.md5)
else
  echo "No checksum file found upstream — skipping verification."
fi

echo "Saved to $OUT_DIR/region.osm.pbf"
