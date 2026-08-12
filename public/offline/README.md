# Offline map archives

Place versioned vector and terrain PMTiles archives in this directory for local
development or image builds. Archives are intentionally ignored by Git because
regional datasets can be very large.

Set `VITE_VECTOR_PMTILES_URL=/offline/region-v1.pmtiles` and optionally
`VITE_TERRAIN_PMTILES_URL=/offline/terrain-v1.pmtiles` before building.
