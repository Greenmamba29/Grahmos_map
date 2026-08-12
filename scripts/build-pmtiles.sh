#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-kenya}"
PBF_URL="${PBF_URL:-https://download.geofabrik.de/africa/kenya-latest.osm.pbf}"
PLANETILER_IMAGE="${PLANETILER_IMAGE:-ghcr.io/onthegomap/planetiler:latest}"
MIN_ZOOM="${MIN_ZOOM:-0}"
MAX_ZOOM="${MAX_ZOOM:-14}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT_DIR}/data"
OUTPUT_DIR="${ROOT_DIR}/public/offline"
PBF_FILE="${DATA_DIR}/${REGION}.osm.pbf"
MBTILES_FILE="${DATA_DIR}/${REGION}.mbtiles"
PMTILES_FILE="${OUTPUT_DIR}/${REGION}.pmtiles"

mkdir -p "${DATA_DIR}" "${OUTPUT_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run Planetiler." >&2
  exit 1
fi

if ! command -v pmtiles >/dev/null 2>&1; then
  echo "Install the PMTiles CLI from https://docs.protomaps.com/pmtiles/cli" >&2
  exit 1
fi

if [[ ! -f "${PBF_FILE}" ]]; then
  curl --fail --location --retry 3 "${PBF_URL}" --output "${PBF_FILE}"
fi

docker run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx${PLANETILER_MEMORY:-4g}" \
  -v "${DATA_DIR}:/data" \
  "${PLANETILER_IMAGE}" \
  --osm_path="/data/${REGION}.osm.pbf" \
  --output="/data/${REGION}.mbtiles" \
  --minzoom="${MIN_ZOOM}" \
  --maxzoom="${MAX_ZOOM}" \
  --force

pmtiles convert "${MBTILES_FILE}" "${PMTILES_FILE}"
pmtiles verify "${PMTILES_FILE}"
pmtiles show "${PMTILES_FILE}"

echo "Created ${PMTILES_FILE}"
