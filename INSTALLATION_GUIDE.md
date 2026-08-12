# Resilience Maps — Installation & Build Guide

An offline-first, Google-Maps-style web app for locating critical infrastructure (hospitals, schools, shelters, water sources, comms towers) during connectivity outages. Built with React, MapLibre GL JS, PMTiles, Supabase/PostGIS, and Workbox.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Screens & Components](#screens--components)
3. [File & Folder Structure](#file--folder-structure)
4. [Required npm Packages](#required-npm-packages)
5. [PMTiles Generation Pipeline](#pmtiles-generation-pipeline)
6. [Supabase Schema (PostGIS)](#supabase-schema-postgis)
7. [Local Development Setup](#local-development-setup)
8. [VPS Deployment (Docker + nginx)](#vps-deployment-docker--nginx)
9. [Build Order (Recommended)](#build-order-recommended)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (PWA)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ React UI    │  │ MapLibre GL  │  │ Workbox SW          │ │
│  │ (Tailwind)  │  │ + PMTiles    │  │ + IndexedDB cache   │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
│         │                │                      │           │
│         └────────────────┼──────────────────────┘           │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │   Supabase (PostGIS)    │
              │   facilities table      │
              │   RPC geospatial queries│
              └─────────────────────────┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Map rendering | MapLibre GL JS | Vector map display, terrain, routing overlay |
| Offline tiles | PMTiles (single-file) | No tile server; HTTP range requests or full download |
| Facility data | Supabase + PostGIS | `ST_DWithin`, category filters, capacity/status |
| Offline cache | Workbox + IndexedDB | App shell, tiles, facility snapshots |
| Styling | Tailwind CSS | Google Maps visual language (#1A73E8 primary) |

---

## Screens & Components

### Pattern 1 — Home / Explore Screen

**Screen:** `ExploreScreen`

| Component | File | Description |
|-----------|------|-------------|
| `MapView` | `src/components/map/MapView.tsx` | Full-bleed MapLibre map with PMTiles source |
| `SearchBar` | `src/components/map/SearchBar.tsx` | Floating rounded search bar (top), mic icon |
| `CategoryChips` | `src/components/map/CategoryChips.tsx` | Horizontal scroll: Hospitals, Schools, Shelters, Water, Power |
| `MyLocationButton` | `src/components/map/MyLocationButton.tsx` | Circular button, bottom-right |
| `DirectionsFAB` | `src/components/map/DirectionsFAB.tsx` | Primary FAB above location button |
| `BottomTabBar` | `src/components/layout/BottomTabBar.tsx` | Tabs: Explore / Routes / Saved / Offline / Alerts |

### Pattern 2 — Layers Control

| Component | File | Description |
|-----------|------|-------------|
| `LayersControl` | `src/components/map/LayersControl.tsx` | Stacked-square icon, top-right |
| `LayersDrawer` | `src/components/map/LayersDrawer.tsx` | Slide-down menu: terrain, satellite, facility categories, offline regions overlay |

### Pattern 3 — Filter Panel

| Component | File | Description |
|-----------|------|-------------|
| `FilterSheet` | `src/components/filters/FilterSheet.tsx` | Slide-up sheet |
| `FilterPills` | `src/components/filters/FilterPills.tsx` | Pill toggles (status, category) |
| `SortControl` | `src/components/filters/SortControl.tsx` | Segmented control: distance / capacity / last updated |
| `RangeSlider` | `src/components/filters/RangeSlider.tsx` | Capacity or distance range |

### Pattern 4 — POI Detail Card

| Component | File | Description |
|-----------|------|-------------|
| `PoiDetailCard` | `src/components/poi/PoiDetailCard.tsx` | Bottom sheet |
| `PoiHeader` | `src/components/poi/PoiHeader.tsx` | Title + status row |
| `PoiActions` | `src/components/poi/PoiActions.tsx` | Directions / Report Status / Save / Call |
| `PoiTabs` | `src/components/poi/PoiTabs.tsx` | Overview / Capacity / Resources / Updates |

### Pattern 5 — Route / Directions Screen

| Component | File | Description |
|-----------|------|-------------|
| `RoutesScreen` | `src/screens/RoutesScreen.tsx` | Full route planning view |
| `RouteMapPreview` | `src/components/routes/RouteMapPreview.tsx` | Top map with route line |
| `ModeTabs` | `src/components/routes/ModeTabs.tsx` | Walk / Drive / Off-road |
| `RouteSummary` | `src/components/routes/RouteSummary.tsx` | ETA + distance row |
| `ElevationProfile` | `src/components/routes/ElevationProfile.tsx` | Terrain elevation chart |
| `TurnByTurnList` | `src/components/routes/TurnByTurnList.tsx` | Numbered steps |
| `RouteCautionBanner` | `src/components/routes/RouteCautionBanner.tsx` | "Route may be blocked / unverified" alert |

### Pattern 6 — Offline Downloads Screen

| Component | File | Description |
|-----------|------|-------------|
| `OfflineScreen` | `src/screens/OfflineScreen.tsx` | Downloaded regions list |
| `OfflineRegionCard` | `src/components/offline/OfflineRegionCard.tsx` | Region name, size MB, status icon |
| `DownloadCTA` | `src/components/offline/DownloadCTA.tsx` | "See what you can download" |
| `RegionSelector` | `src/components/offline/RegionSelector.tsx` | Bounding-box selector on map |
| `SizeEstimate` | `src/components/offline/SizeEstimate.tsx` | Live MB estimate |

### Additional Screens (placeholders in scaffold)

| Screen | File | Tab |
|--------|------|-----|
| `SavedScreen` | `src/screens/SavedScreen.tsx` | Saved |
| `AlertsScreen` | `src/screens/AlertsScreen.tsx` | Alerts |

---

## File & Folder Structure

```
resilience-maps/
├── INSTALLATION_GUIDE.md          # This file
├── README.md
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── index.html
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── nginx/
│   └── nginx.conf
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── icons/                     # App icons
│   └── tiles/
│       └── region.pmtiles         # Offline vector tiles (generated)
├── scripts/
│   ├── generate-pmtiles.sh        # OSM → PMTiles pipeline wrapper
│   └── seed-facilities.sql        # Sample facility data
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20240812000000_facilities.sql
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── types/
    │   ├── facility.ts
    │   ├── layers.ts
    │   └── navigation.ts
    ├── lib/
    │   ├── supabase.ts
    │   ├── pmtiles.ts             # PMTiles protocol registration
    │   ├── mapStyle.ts            # MapLibre style JSON builder
    │   └── offline/
    │       ├── db.ts              # IndexedDB wrapper
    │       └── regions.ts         # Offline region management
    ├── hooks/
    │   ├── useMap.ts
    │   ├── useFacilities.ts
    │   ├── useLayers.ts
    │   └── useGeolocation.ts
    ├── context/
    │   ├── MapContext.tsx
    │   └── LayersContext.tsx
    ├── components/
    │   ├── map/
    │   │   ├── MapView.tsx
    │   │   ├── SearchBar.tsx
    │   │   ├── CategoryChips.tsx
    │   │   ├── LayersControl.tsx
    │   │   ├── LayersDrawer.tsx
    │   │   ├── MyLocationButton.tsx
    │   │   └── DirectionsFAB.tsx
    │   ├── layout/
    │   │   └── BottomTabBar.tsx
    │   ├── filters/
    │   │   ├── FilterSheet.tsx
    │   │   ├── FilterPills.tsx
    │   │   ├── SortControl.tsx
    │   │   └── RangeSlider.tsx
    │   ├── poi/
    │   │   ├── PoiDetailCard.tsx
    │   │   ├── PoiHeader.tsx
    │   │   ├── PoiActions.tsx
    │   │   └── PoiTabs.tsx
    │   ├── routes/
    │   │   ├── RouteMapPreview.tsx
    │   │   ├── ModeTabs.tsx
    │   │   ├── RouteSummary.tsx
    │   │   ├── ElevationProfile.tsx
    │   │   ├── TurnByTurnList.tsx
    │   │   └── RouteCautionBanner.tsx
    │   ├── offline/
    │   │   ├── OfflineRegionCard.tsx
    │   │   ├── DownloadCTA.tsx
    │   │   ├── RegionSelector.tsx
    │   │   └── SizeEstimate.tsx
    │   └── ui/
    │       ├── Sheet.tsx
    │       ├── FAB.tsx
    │       ├── Chip.tsx
    │       └── IconButton.tsx
    └── screens/
        ├── ExploreScreen.tsx
        ├── RoutesScreen.tsx
        ├── SavedScreen.tsx
        ├── OfflineScreen.tsx
        └── AlertsScreen.tsx
```

---

## Required npm Packages

### Production dependencies

```bash
npm install react react-dom
npm install maplibre-gl pmtiles
npm install @supabase/supabase-js
npm install lucide-react                    # Icons (mic, layers, navigation, etc.)
npm install clsx tailwind-merge             # Conditional class utilities
```

### Development dependencies

```bash
npm install -D typescript @types/react @types/react-dom
npm install -D vite @vitejs/plugin-react
npm install -D tailwindcss postcss autoprefixer
npm install -D vite-plugin-pwa workbox-window workbox-precaching workbox-routing workbox-strategies
npm install -D @types/geojson
```

### Package summary

| Package | Version (min) | Purpose |
|---------|--------------|---------|
| `maplibre-gl` | ^4.x | Map rendering |
| `pmtiles` | ^3.x | Single-file vector tile protocol |
| `@supabase/supabase-js` | ^2.x | Facility API + auth |
| `vite-plugin-pwa` | ^0.20.x | Workbox service worker generation |
| `lucide-react` | ^0.4.x | UI icons |
| `tailwindcss` | ^3.4.x | Utility-first CSS |

---

## PMTiles Generation Pipeline

PMTiles packs vector tiles into a single file served via HTTP range requests — ideal for offline download and no dedicated tile server.

### Prerequisites

- [Planetiler](https://github.com/onthegomap/planetiler) (Java) **or** [tilemaker](https://github.com/systemed/tilemaker) + [pmtiles CLI](https://github.com/protomaps/go-pmtiles)
- [OpenStreetMap extract](https://download.geofabrik.de/) (`.osm.pbf` for your region)
- [Natural Earth](https://www.naturalearthdata.com/) data (for low-zoom context)

### Option A — Planetiler (recommended)

```bash
# 1. Download OSM extract (example: Colorado)
wget https://download.geofabrik.de/north-america/us/colorado-latest.osm.pbf

# 2. Run Planetiler → MBTiles
java -Xmx8g -jar planetiler.jar \
  --download \
  --area=colorado \
  --output=colorado.mbtiles

# 3. Convert MBTiles → PMTiles
pmtiles convert colorado.mbtiles public/tiles/region.pmtiles

# 4. (Optional) Add terrain hillshade from DEM
# Use gdal to generate raster tiles, or embed terrain in Planetiler with --terrain
```

### Option B — tilemaker + go-pmtiles

```bash
# 1. Build tilemaker with Lua profile
tilemaker --input region.osm.pbf --output region.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua

# 2. Convert to PMTiles
pmtiles convert region.mbtiles public/tiles/region.pmtiles
```

### Integrating with MapLibre

```typescript
// src/lib/pmtiles.ts
import { Protocol } from 'pmtiles';
import maplibregl from 'maplibre-gl';

let protocolAdded = false;

export function registerPmtilesProtocol() {
  if (protocolAdded) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolAdded = true;
}
```

Map style source:

```json
{
  "sources": {
    "basemap": {
      "type": "vector",
      "url": "pmtiles:///tiles/region.pmtiles"
    }
  }
}
```

### Offline download flow

1. User draws bounding box on `RegionSelector`
2. App estimates size via PMTiles header + tile coverage math
3. `fetch()` with range requests downloads full `.pmtiles` to IndexedDB/blob
4. Service worker caches the file; map reads from `blob:` URL when offline

---

## Supabase Schema (PostGIS)

### Enable PostGIS

```sql
-- Run in Supabase SQL Editor or migration
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Facilities table

```sql
-- supabase/migrations/20240812000000_facilities.sql

CREATE TYPE facility_category AS ENUM (
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
  'comms'
);

CREATE TYPE facility_status AS ENUM (
  'operational',
  'limited',
  'closed',
  'unknown'
);

CREATE TABLE facilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      facility_category NOT NULL,
  status        facility_status NOT NULL DEFAULT 'unknown',
  capacity      INTEGER,                    -- beds, seats, gallons/day, etc.
  capacity_unit TEXT,                       -- 'beds', 'seats', 'gallons', 'kw'
  phone         TEXT,
  website       TEXT,
  description   TEXT,
  resources     JSONB DEFAULT '[]',         -- [{name, quantity, unit}]
  geom          GEOGRAPHY(POINT, 4326) NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX facilities_geom_idx ON facilities USING GIST (geom);
CREATE INDEX facilities_category_idx ON facilities (category);
CREATE INDEX facilities_status_idx ON facilities (status);

-- Row Level Security
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON facilities FOR SELECT
  USING (true);

CREATE POLICY "Authenticated insert"
  ON facilities FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update"
  ON facilities FOR UPDATE
  USING (auth.role() = 'authenticated');
```

### Geospatial query RPC

```sql
CREATE OR REPLACE FUNCTION facilities_nearby(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 5000,
  categories facility_category[] DEFAULT NULL,
  min_capacity INTEGER DEFAULT NULL,
  facility_statuses facility_status[] DEFAULT NULL
)
RETURNS SETOF facilities
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM facilities f
  WHERE ST_DWithin(
    f.geom,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  AND (categories IS NULL OR f.category = ANY(categories))
  AND (min_capacity IS NULL OR f.capacity >= min_capacity)
  AND (facility_statuses IS NULL OR f.status = ANY(facility_statuses))
  ORDER BY ST_Distance(f.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);
$$;
```

### Sample seed data

```sql
INSERT INTO facilities (name, category, status, capacity, capacity_unit, phone, geom) VALUES
  ('Central Memorial Hospital', 'hospital', 'operational', 250, 'beds', '+1-555-0100',
   ST_SetSRID(ST_MakePoint(-105.2705, 40.0150), 4326)::geography),
  ('Lincoln Elementary', 'school', 'operational', 400, 'seats', '+1-555-0101',
   ST_SetSRID(ST_MakePoint(-105.2800, 40.0200), 4326)::geography),
  ('Community Shelter A', 'shelter', 'limited', 150, 'seats', '+1-555-0102',
   ST_SetSRID(ST_MakePoint(-105.2600, 40.0100), 4326)::geography),
  ('Municipal Water Plant', 'water', 'operational', 50000, 'gallons', '+1-555-0103',
   ST_SetSRID(ST_MakePoint(-105.2500, 40.0050), 4326)::geography),
  ('Tower Ridge Comms', 'comms', 'operational', NULL, NULL, '+1-555-0104',
   ST_SetSRID(ST_MakePoint(-105.2900, 40.0250), 4326)::geography);
```

### Environment variables

```env
# .env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_PMTILES_URL=/tiles/region.pmtiles
VITE_MAP_DEFAULT_CENTER=-105.2705,40.0150
VITE_MAP_DEFAULT_ZOOM=12
```

---

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url> resilience-maps
cd resilience-maps
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 2. Supabase local (optional)

```bash
npx supabase init          # if not already done
npx supabase start         # starts local Postgres + PostGIS
npx supabase db push       # apply migrations
psql $DATABASE_URL -f scripts/seed-facilities.sql
```

Or use hosted Supabase: run migration SQL in the dashboard SQL editor.

### 3. Generate or place PMTiles

```bash
# Place a .pmtiles file at public/tiles/region.pmtiles
# Or run the generation pipeline (see above)
bash scripts/generate-pmtiles.sh
```

For development without tiles, the app falls back to the free MapLibre demo style.

### 4. Start dev server

```bash
npm run dev
# Open http://localhost:5173
```

### 5. Build for production

```bash
npm run build
npm run preview   # test production build locally
```

---

## VPS Deployment (Docker + nginx)

### Dockerfile

Multi-stage build: Node builds static assets, nginx serves them.

```dockerfile
# See Dockerfile in repo root
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY public/tiles /usr/share/nginx/html/tiles
EXPOSE 80
```

### nginx configuration highlights

- `gzip` for JS/CSS
- `Accept-Ranges: bytes` for PMTiles range requests
- SPA fallback: `try_files $uri $uri/ /index.html`
- Cache headers for hashed assets; no-cache for `index.html`
- Optional TLS via Certbot / Let's Encrypt reverse proxy

### docker-compose.yml

```yaml
services:
  web:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
    ports:
      - "80:80"
    restart: unless-stopped
    volumes:
      - ./public/tiles:/usr/share/nginx/html/tiles:ro
```

### Deploy steps

```bash
# On VPS
git clone <repo-url> && cd resilience-maps
cp .env.example .env && nano .env

docker compose build
docker compose up -d

# Verify
curl -I http://localhost/tiles/region.pmtiles   # Should return 206 Partial Content
```

### TLS (recommended)

```bash
# Using Caddy or Certbot in front of nginx
certbot --nginx -d maps.example.org
```

---

## Build Order (Recommended)

| Phase | Items | Status |
|-------|-------|--------|
| **1 — Foundation** | Vite scaffold, Tailwind, types, Supabase client | ✅ Scaffold |
| **2 — Explore** | MapView, SearchBar, CategoryChips, LayersControl/Drawer, BottomTabBar | ✅ Scaffold |
| **3 — Data** | Facility markers, `useFacilities`, PostGIS RPC | Pending |
| **4 — POI** | PoiDetailCard, filter sheet | Pending |
| **5 — Routes** | Route screen, elevation profile, caution banner | Pending |
| **6 — Offline** | Region download, IndexedDB, Workbox SW | Pending |
| **7 — Polish** | Alerts tab, Saved tab, PWA manifest, icons | Pending |

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#1A73E8` | FAB, active tab, links |
| Surface | `#FFFFFF` | Cards, sheets |
| Background | `#F8F9FA` | App background |
| Text primary | `#202124` | Headings, body |
| Text secondary | `#5F6368` | Subtitles, placeholders |
| Shadow | `0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)` | Floating elements |
| Radius card | `1rem` (`rounded-2xl`) | Search bar, sheets |
| Radius chip | `9999px` (`rounded-full`) | Category chips |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Map blank | Check PMTiles path; verify `registerPmtilesProtocol()` called before map init |
| CORS on PMTiles | Serve from same origin or configure nginx `add_header Access-Control-Allow-Origin` |
| PostGIS queries fail | Ensure `postgis` extension enabled; check RPC parameter types |
| Service worker stale | Hard refresh; check Workbox `skipWaiting` + `clientsClaim` |
| Large PMTiles slow | Use regional extracts; enable gzip disabled for binary (nginx: `gzip_types` exclude pmtiles) |

---

*Generated for Resilience Maps v0.1.0 — scaffold phase.*
