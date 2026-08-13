# Resilience Maps — Walkthrough

Offline-first critical-infrastructure map (hospitals, schools, shelters, water, power, comms) with terrain-aware routing and region downloads.

## What shipped

1. **`INSTALLATION_GUIDE.md`** — screens/components, folder structure, npm packages, PMTiles pipeline from OSM, Supabase PostGIS schema, Docker + nginx deploy.
2. **Full React + TypeScript app** matching the six Google Maps reference patterns (Explore, Layers, Filters, POI card, Routes, Offline downloads), plus Saved and Alerts tabs.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

No Supabase or PMTiles required for the demo: bundled San Francisco facilities + OpenFreeMap online style. See the installation guide for offline tiles and a live PostGIS backend.

## UI flows verified

| Flow | Result |
|---|---|
| Explore chrome (search, chips, layers, FABs, tabs) | Pass |
| Category chip toggle + filter sheet (pills, sort, sliders) | Pass |
| Search → POI card (Overview / Capacity / Resources / Updates) | Pass |
| Report Status modal (updates status; queues offline) | Pass |
| Routes: Walk/Bike/Drive, ETA, elevation profile, caution banner, steps | Pass |
| Offline: CTA, region list with MB sizes, bbox selector + download | Pass |
| Saved empty state + Alerts severity feed | Pass |
| Production build + Workbox SW generation | Pass |

Map tiles need WebGL. In environments that block it, the app shows a clear fallback; search, POI, routes math, and offline downloads still work.

<img alt="POI detail card" src="/opt/cursor/artifacts/screenshots/poi-card.webp" />
<img alt="Routes with elevation profile" src="/opt/cursor/artifacts/screenshots/routes-drive.webp" />
<img alt="Offline region selector" src="/opt/cursor/artifacts/screenshots/offline-selector.webp" />

## Branch

`cursor/resilience-maps-73b2` — open the PR from that branch against `main`.
