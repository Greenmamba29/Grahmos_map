#!/usr/bin/env bash
# Converts the raster-dem MBTiles (from 02_build_terrain_dem.sh) into a
# single-file PMTiles archive used for the hillshade/contour terrain
# overlay and the Route screen's elevation profile. See
# INSTALLATION_GUIDE.md §4.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$ROOT_DIR/public/tiles"

go-pmtiles convert "$ROOT_DIR/data/terrain/terrain.mbtiles" "$ROOT_DIR/public/tiles/terrain.pmtiles"
go-pmtiles verify "$ROOT_DIR/public/tiles/terrain.pmtiles"

echo "Done: $ROOT_DIR/public/tiles/terrain.pmtiles"
