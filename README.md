# Resilience Maps

Offline-first critical infrastructure maps for outages and disaster response.

This scaffold starts the Explore experience from the product guide:

- React + TypeScript + Vite
- MapLibre GL JS with PMTiles protocol support
- Tailwind CSS visual system inspired by Google Maps mobile patterns
- Supabase/PostGIS schema for geospatial facility queries
- Workbox-powered PWA caching and IndexedDB offline metadata
- Docker + nginx deployment scaffold

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Place a PMTiles archive at `public/tiles/resilience-demo.pmtiles`, or set `VITE_PMTILES_URL` in `.env.local`.

## Documentation

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for the full screen inventory, PMTiles pipeline, Supabase schema, and VPS deployment steps.
