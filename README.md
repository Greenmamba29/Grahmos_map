# Resilience Maps

Offline-first, Google-Maps-style web app for locating critical infrastructure during connectivity outages.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

## Documentation

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for:

- Full screen/component inventory
- PMTiles generation pipeline
- Supabase/PostGIS schema
- Docker + nginx deployment

## Tech Stack

- **React + TypeScript** (Vite)
- **MapLibre GL JS** + PMTiles
- **Supabase** + PostGIS
- **Workbox** (vite-plugin-pwa)
- **Tailwind CSS**

## Current Status (v0.1.0 scaffold)

- ✅ Explore screen with full-bleed map
- ✅ Search bar + category filter chips
- ✅ Layers control drawer
- ✅ Bottom tab navigation
- 🔲 Facility POI markers (Phase 3)
- 🔲 POI detail card (Phase 4)
- 🔲 Routes + elevation (Phase 5)
- 🔲 Offline region download (Phase 6)
