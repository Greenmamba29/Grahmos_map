#!/usr/bin/env bash
# PMTiles generation pipeline wrapper
# See INSTALLATION_GUIDE.md for full documentation
set -euo pipefail

REGION="${1:-colorado}"
OUTPUT_DIR="public/tiles"
OUTPUT_FILE="${OUTPUT_DIR}/region.pmtiles"

echo "==> Resilience Maps PMTiles Pipeline"
echo "    Region: ${REGION}"
echo "    Output: ${OUTPUT_FILE}"

mkdir -p "${OUTPUT_DIR}"

if ! command -v pmtiles &> /dev/null; then
  echo "ERROR: pmtiles CLI not found. Install from https://github.com/protomaps/go-pmtiles"
  exit 1
fi

OSM_FILE="${REGION}.osm.pbf"
if [ ! -f "${OSM_FILE}" ]; then
  echo "==> Downloading OSM extract for ${REGION}..."
  wget -q "https://download.geofabrik.de/north-america/us/${REGION}-latest.osm.pbf" -O "${OSM_FILE}"
fi

if command -v java &> /dev/null && [ -f "planetiler.jar" ]; then
  echo "==> Running Planetiler..."
  java -Xmx8g -jar planetiler.jar \
    --osm-path="${OSM_FILE}" \
    --output="${REGION}.mbtiles" \
    --download

  echo "==> Converting to PMTiles..."
  pmtiles convert "${REGION}.mbtiles" "${OUTPUT_FILE}"
else
  echo "WARN: Planetiler not available. Place a .pmtiles file at ${OUTPUT_FILE} manually."
  echo "      See INSTALLATION_GUIDE.md for alternative methods."
fi

echo "==> Done. PMTiles at ${OUTPUT_FILE}"
