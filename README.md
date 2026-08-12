# Resilience Maps

An offline-first map for locating hospitals, schools, shelters, water points,
and power infrastructure during connectivity outages.

The initial scaffold includes a responsive MapLibre Explore screen, PMTiles
protocol support, category filters, a layers drawer, geolocation, Supabase
facility loading with IndexedDB fallback, and an installable Workbox-powered
PWA.

## Start locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The app uses demo facilities and an online OpenStreetMap fallback until PMTiles
and Supabase values are configured.

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for the complete screen
plan, PostGIS schema, PMTiles build pipeline, offline architecture, and Docker
deployment instructions.
