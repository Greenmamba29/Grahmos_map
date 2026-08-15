# Resilience Maps

An offline-first critical-infrastructure map built with React, MapLibre,
PMTiles, Supabase/PostGIS, Workbox, and IndexedDB.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app starts with a built-in demonstration dataset and OpenStreetMap fallback.
Configure Supabase and local PMTiles archives to enable production data and
terrain-aware offline rendering.

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for the complete screen
inventory, architecture, data pipeline, database schema, and deployment steps.
