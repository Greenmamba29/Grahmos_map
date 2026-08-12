# Resilience Maps

Offline-first, Google-Maps-styled web app for locating critical
infrastructure — hospitals, schools, shelters, water sources, comms towers,
and power sites — during connectivity outages, using terrain-aware offline
vector tiles.

Built with React + TypeScript, MapLibre GL JS + PMTiles (single-file
offline tiles, no tile server needed), Supabase/PostGIS for facility data,
Workbox + IndexedDB for offline caching, and Tailwind CSS.

See [`INSTALLATION_GUIDE.md`](./INSTALLATION_GUIDE.md) for the full screen
inventory, folder structure, PMTiles generation pipeline, Supabase schema,
and local/VPS deployment instructions.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: fill in Supabase credentials
npm run dev                  # http://localhost:5173
```

Works out of the box with a bundled mock facility fixture and OpenStreetMap
raster fallback tiles — no Supabase project or generated PMTiles archives
required for local development.
