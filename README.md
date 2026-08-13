# Resilience Maps

Offline-first mapping for locating **hospitals, schools, shelters, water sources,
power infrastructure and comms towers** during connectivity outages. Terrain-aware
routing runs on the device. A single PMTiles archive replaces a tile server.

This repository is the first scaffold of that app: the Explore map, category
chips, layers drawer, filter sheet, facility detail card, routes screen, offline
downloads screen, and the local data layer (IndexedDB + bundled seed + optional
Supabase/PostGIS).

The full specification — every screen, the file layout, the PMTiles pipeline,
the PostGIS schema and VPS deployment — lives in
[INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

No environment variables are required. Without a PMTiles archive or a Supabase
project the app falls back to a raster basemap and the bundled Port-au-Prince
facility list, so the UI is fully explorable on first run.

```bash
npm run typecheck
npm run lint
npm run build        # production bundle + Workbox service worker
npm run preview      # serve dist/, then DevTools → Network → Offline
```

## Configuration

Copy `.env.example` to `.env.local` and fill in only what you have:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Live facility registry |
| `VITE_BASEMAP_PMTILES_URL` | Vector basemap archive (`/tiles/region.pmtiles`) |
| `VITE_TERRAIN_PMTILES_URL` | Terrain-RGB DEM archive (`/tiles/terrain.pmtiles`) |
| `VITE_DEFAULT_CENTER` / `VITE_DEFAULT_ZOOM` | Opening camera (`lon,lat`) |

Generate tiles with `./scripts/make-pmtiles.sh` and `./scripts/make-terrain.sh`.
Apply the schema with the files in `supabase/migrations/`, then seed:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed/facilities.seed.sql
# or
SUPABASE_DB_URL=postgres://… npm run seed
```

## Deploy

```bash
docker compose up -d --build
```

The container listens on `127.0.0.1:8080`. Put a host nginx with TLS in front of
it — service workers, geolocation and persistent storage all require HTTPS. See
[INSTALLATION_GUIDE.md §13](./INSTALLATION_GUIDE.md#13-vps-deployment-docker--nginx).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · MapLibre GL JS · PMTiles ·
Supabase / PostGIS · Workbox · IndexedDB (`idb`) · Zustand
