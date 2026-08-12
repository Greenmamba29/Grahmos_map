#!/usr/bin/env bash
# Clips a DEM to the region bounding box and produces a raster-dem MBTiles
# via rio-rgbify (Terrain-RGB encoding). Requires gdal + rio-rgbify.
# See INSTALLATION_GUIDE.md §4.
set -euo pipefail

BBOX="${1:?Usage: 02_build_terrain_dem.sh <minlon,minlat,maxlon,maxlat> <dem.tif>}"
DEM_SRC="${2:?missing DEM source geotiff (e.g. Copernicus GLO-30 / SRTM 30m tile)}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/data/terrain"
mkdir -p "$OUT_DIR"

IFS=',' read -r MINLON MINLAT MAXLON MAXLAT <<< "$BBOX"

echo "Clipping DEM to bbox: $BBOX"
gdalwarp -te "$MINLON" "$MINLAT" "$MAXLON" "$MAXLAT" -of GTiff "$DEM_SRC" "$OUT_DIR/clipped.tif"

echo "Encoding Terrain-RGB…"
rio rgbify -b -10000 -i 0.1 "$OUT_DIR/clipped.tif" "$OUT_DIR/terrain-rgb.tif"

echo "Building raster-dem MBTiles…"
gdal_translate -of MBTILES "$OUT_DIR/terrain-rgb.tif" "$OUT_DIR/terrain.mbtiles"

echo "Done: $OUT_DIR/terrain.mbtiles"
