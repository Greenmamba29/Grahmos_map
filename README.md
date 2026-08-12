# Resilience Maps

Offline-first, Google-Maps-style web app for locating critical infrastructure —
hospitals, schools, shelters, water sources, power and comms — during
connectivity outages, with terrain-aware offline tiles.

- **React + TypeScript + Tailwind** UI in the Google Maps visual language
- **MapLibre GL JS + PMTiles** — single-file offline vector tiles, no tile server
- **Supabase + PostGIS** — facility data with geospatial queries (optional; the
  app runs fully on bundled demo data without a backend)
- **Workbox service worker + IndexedDB** — app shell, tiles and facility data
  keep working with zero connectivity

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (service worker active):

```bash
npm run build && npm run preview
```

## Documentation

See **[INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)** for the full guide:
every screen/component, folder structure, the PMTiles generation pipeline from
OpenStreetMap extracts, the Supabase schema, and step-by-step local + VPS
deployment (Docker + nginx).

## Screens

| Tab | What it does |
|---|---|
| **Explore** | Full-bleed map, search, category chips (Hospitals/Schools/Shelters/Water/Power/Comms), layers drawer, filter sheet, facility detail card |
| **Routes** | Terrain-aware directions with elevation profile and caution banners |
| **Saved** | Starred facilities for your emergency plan, available offline |
| **Offline** | Download regions (bounding-box selector + live size estimate) |
| **Alerts** | Status changes and emergency broadcasts |
