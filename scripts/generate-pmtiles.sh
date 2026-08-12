#!/usr/bin/env bash
set -euo pipefail

OSM_EXTRACT="${1:-data/osm/region.osm.pbf}"
OUT_DIR="${2:-public/tiles}"
REGION_NAME="${3:-resilience-demo}"

mkdir -p data/osm data/geojson "$OUT_DIR"

if [[ ! -f "$OSM_EXTRACT" ]]; then
  echo "Missing OSM extract: $OSM_EXTRACT" >&2
  echo "Download one from https://download.geofabrik.de/ and pass it as the first argument." >&2
  exit 1
fi

osmium tags-filter "$OSM_EXTRACT" \
  n/amenity=hospital,w/amenity=hospital,r/amenity=hospital \
  n/amenity=clinic,w/amenity=clinic,r/amenity=clinic \
  n/amenity=school,w/amenity=school,r/amenity=school \
  n/amenity=shelter,w/amenity=shelter,r/amenity=shelter \
  n/emergency=assembly_point,w/emergency=assembly_point,r/emergency=assembly_point \
  n/amenity=drinking_water,w/amenity=drinking_water,r/amenity=drinking_water \
  n/man_made=water_well,w/man_made=water_well,r/man_made=water_well \
  n/power=*,w/power=*,r/power=* \
  n/man_made=communications_tower,w/man_made=communications_tower,r/man_made=communications_tower \
  n/tower:type=communication,w/tower:type=communication,r/tower:type=communication \
  -o "data/osm/${REGION_NAME}-infra.osm.pbf" --overwrite

ogr2ogr -f GeoJSONSeq \
  "data/geojson/${REGION_NAME}-infra.geojsonseq" \
  "data/osm/${REGION_NAME}-infra.osm.pbf"

tippecanoe \
  -o "data/${REGION_NAME}.mbtiles" \
  --force \
  --minimum-zoom=5 \
  --maximum-zoom=14 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  -L "infrastructure:data/geojson/${REGION_NAME}-infra.geojsonseq"

pmtiles convert "data/${REGION_NAME}.mbtiles" "$OUT_DIR/${REGION_NAME}.pmtiles"
pmtiles show "$OUT_DIR/${REGION_NAME}.pmtiles"
