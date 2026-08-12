# Resilience Maps

Offline-first, Google-Maps-style web app for locating **critical infrastructure** (hospitals, schools, shelters, water, power, comms) during connectivity outages — powered by MapLibre GL + PMTiles, Supabase/PostGIS, and Workbox.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:5173 — Explore map loads with demo facilities (Denver metro). Connect Supabase credentials for live PostGIS data.

## Docs

See **[INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)** for:

- Screen/component inventory (Explore, Layers, Filters, POI, Routes, Offline)
- Folder structure & npm packages
- PMTiles generation from OSM extracts
- Supabase schema
- Local + Docker/nginx VPS deployment

## Stack

React · TypeScript · Vite · Tailwind CSS · MapLibre GL JS · PMTiles · Supabase · Workbox

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview build |
| `npm run lint` | Lint |
| `./scripts/generate-pmtiles.sh` | OSM → PMTiles pipeline |
| `docker compose -f docker/docker-compose.yml up -d --build` | Serve via nginx |
