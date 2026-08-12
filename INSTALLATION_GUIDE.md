# Resilience Maps — Installation & Architecture Guide

Offline-first, Google-Maps-style web app for locating critical infrastructure (hospitals, schools, shelters, water sources, communications towers) during connectivity outages, using terrain-aware offline vector tiles (PMTiles).

**Stack:** React + TypeScript · MapLibre GL JS · PMTiles · Supabase (PostGIS) · Workbox · IndexedDB · Tailwind CSS

**Primary accent:** `#1A73E8` (Google Maps blue) · White cards · `rounded-2xl` · Soft shadows

---

## Table of Contents

1. [Screens & Components (Reference UI Patterns)](#1-screens--components-reference-ui-patterns)
2. [File / Folder Structure](#2-file--folder-structure)
3. [Required npm Packages](#3-required-npm-packages)
4. [PMTiles Generation Pipeline](#4-pmtiles-generation-pipeline)
5. [Supabase Schema (PostGIS)](#5-supabase-schema-postgis)
6. [Local Development Setup](#6-local-development-setup)
7. [VPS Deployment (Docker + nginx)](#7-vps-deployment-docker--nginx)
8. [Environment Variables](#8-environment-variables)
9. [Implementation Order](#9-implementation-order)

---

## 1. Screens & Components (Reference UI Patterns)

Map each Google Maps iOS / Mobbin pattern to Resilience Maps surfaces.

### 1.1 Home / Explore Screen

| Google Maps pattern | Resilience Maps |
|---|---|
| Full-bleed map | Full-viewport MapLibre map (PMTiles / online fallback) |
| Floating rounded search bar + mic | Search bar: place / facility query + voice (Web Speech API optional) |
| Horizontal category chips | `Hospitals` · `Schools` · `Shelters` · `Water` · `Power` · `Comms` |
| Circular “my location” | Recenter on GPS / last known offline position |
| Primary FAB (directions) | Open route / directions flow |
| Bottom tabs: Explore / Go / Saved / Contribute / Updates | **Explore · Routes · Saved · Offline · Alerts** |

**Components to build**

- `ExploreScreen` — shell layout (map + overlays + tab bar)
- `MapView` — MapLibre GL JS map container (PMTiles protocol)
- `SearchBar` — floating top search + optional mic button
- `CategoryChips` — horizontally scrollable facility category filters
- `MyLocationButton` — circular FAB, bottom-right stack
- `RouteFab` — larger primary FAB for directions
- `BottomTabBar` — five tabs with icons + active state
- `LayersButton` — circular stacked-squares control (top-right)

### 1.2 Layers Control

| Google Maps pattern | Resilience Maps |
|---|---|
| Stacked-square layers icon | Same affordance, top-right of map |
| Layers drawer / menu | Toggle base map + overlays |

**Components**

- `LayersDrawer` — sheet or popover menu
- Toggles: **Terrain** · **Satellite** · **Facility categories** (per-type) · **Offline-downloaded regions** overlay
- Optional: hazard / flood / road-status overlays (future)

### 1.3 Filter Panel

| Google Maps pattern | Resilience Maps |
|---|---|
| Slide-up filter sheet | Same pattern for facilities |
| Pill filter toggles | Status: Open / Limited / Closed / Unknown |
| Sort-by segmented control | Distance · Capacity · Last updated · Status |
| Price range slider | **Capacity** and/or **Distance** range |

**Components**

- `FilterSheet` — bottom sheet
- `PillToggleGroup` — multi-select status / amenity filters
- `SegmentedControl` — sort mode
- `RangeSlider` — capacity or distance

### 1.4 POI Detail Card

| Google Maps pattern | Resilience Maps |
|---|---|
| Bottom sheet title + rating row | Title + **operational status** + last updated |
| Action pills: Directions / Share / Save / Website | **Directions · Report Status · Save · Call** |
| Tabs: Overview / Photos / Reviews | **Overview · Capacity · Resources · Updates** |

**Components**

- `PoiDetailSheet` — draggable bottom sheet
- `StatusBadge` — open / limited / closed / unverified
- `ActionPillRow` — Directions / Report Status / Save / Call
- `PoiTabs` — Overview | Capacity | Resources | Updates
- Tab panels: description, capacity meters, resource checklist, community status updates

### 1.5 Route / Directions Screen

| Google Maps pattern | Resilience Maps |
|---|---|
| Top map + route line | MapLibre route polyline (terrain-aware path when available) |
| Mode tabs | Walk / Drive / Bike / Evacuation (custom) |
| ETA + distance | Same + terrain difficulty hint |
| Elevation profile chart | **Critical** — elevation / slope along route |
| Turn-by-turn list | Numbered steps |
| Preview / Show map | Sticky bottom actions |
| “Conditions may vary” banner | **“Route may be blocked / unverified”** resilience alert |

**Components**

- `RouteScreen`
- `RouteMapPreview`
- `TravelModeTabs`
- `EtaDistanceRow`
- `ElevationProfileChart`
- `TurnByTurnList`
- `RouteCautionBanner`
- `RouteBottomActions`

### 1.6 Offline Downloads Screen

| Google Maps pattern | Resilience Maps |
|---|---|
| Downloaded items + size MB | Downloaded **regions** (PMTiles packs / tile caches) |
| “See what you can download” CTA | **Download region for offline use** |
| Per-item status icons | Queued / Downloading / Ready / Error / Stale |
| Region picker | Bounding-box selector on map + **live size estimate** |

**Components**

- `OfflineScreen`
- `DownloadedRegionList` — name, bounds summary, size MB, status icon
- `DownloadRegionCta` — prominent CTA
- `RegionSelectorMap` — drag box / polygon on map
- `SizeEstimateBadge` — live MB estimate from zoom range + bbox
- `OfflineProgressRow` — Workbox / IndexedDB download progress

### Shared UI primitives

- `BottomSheet`, `FloatingCard`, `IconButton`, `Fab`, `Banner`, `SegmentedControl`, `Chip`, `RangeSlider`, `EmptyState`, `Spinner`

---

## 2. File / Folder Structure

```text
resilience-maps/                 # or repo root
├── INSTALLATION_GUIDE.md
├── README.md
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
├── .env.example
├── .gitignore
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   └── tiles/                   # optional local PMTiles for dev
│       └── .gitkeep
├── docker/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── docker-compose.yml
├── scripts/
│   ├── generate-pmtiles.sh      # OSM extract → PMTiles
│   └── estimate-region-size.mjs # bbox size estimator helper
├── supabase/
│   ├── config.toml              # optional local Supabase
│   └── migrations/
│       └── 001_facilities.sql
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                # Tailwind + design tokens
│   ├── vite-env.d.ts
│   ├── types/
│   │   ├── facility.ts
│   │   ├── route.ts
│   │   └── offline.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── maplibre.ts          # PMTiles protocol registration
│   │   ├── idb.ts               # IndexedDB helpers
│   │   └── geo.ts               # distance, bbox, formatters
│   ├── data/
│   │   └── mockFacilities.ts    # offline / demodata
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   ├── useFacilities.ts
│   │   ├── useOfflineRegions.ts
│   │   └── useMapLayers.ts
│   ├── store/
│   │   └── uiStore.ts           # lightweight UI state (optional)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BottomTabBar.tsx
│   │   │   └── AppShell.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── LayersButton.tsx
│   │   │   ├── LayersDrawer.tsx
│   │   │   ├── MyLocationButton.tsx
│   │   │   └── RouteFab.tsx
│   │   ├── explore/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── CategoryChips.tsx
│   │   │   └── FilterSheet.tsx
│   │   ├── poi/
│   │   │   ├── PoiDetailSheet.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ActionPillRow.tsx
│   │   │   └── PoiTabs.tsx
│   │   ├── route/
│   │   │   ├── RouteScreen.tsx
│   │   │   ├── ElevationProfileChart.tsx
│   │   │   ├── TurnByTurnList.tsx
│   │   │   └── RouteCautionBanner.tsx
│   │   ├── offline/
│   │   │   ├── OfflineScreen.tsx
│   │   │   ├── DownloadedRegionList.tsx
│   │   │   ├── DownloadRegionCta.tsx
│   │   │   └── RegionSelectorMap.tsx
│   │   └── ui/
│   │       ├── BottomSheet.tsx
│   │       ├── Chip.tsx
│   │       ├── Fab.tsx
│   │       ├── IconButton.tsx
│   │       ├── Banner.tsx
│   │       ├── SegmentedControl.tsx
│   │       └── RangeSlider.tsx
│   ├── screens/
│   │   ├── ExploreScreen.tsx
│   │   ├── RoutesScreen.tsx
│   │   ├── SavedScreen.tsx
│   │   ├── OfflineScreen.tsx
│   │   └── AlertsScreen.tsx
│   └── sw.ts                    # Workbox service worker entry (vite-plugin-pwa)
└── docs/
    └── architecture.md          # optional deeper notes
```

---

## 3. Required npm Packages

### Core app

| Package | Purpose |
|---|---|
| `react` / `react-dom` | UI |
| `typescript` | Types |
| `vite` | Bundler / dev server |
| `@vitejs/plugin-react` | React Fast Refresh |

### Map & tiles

| Package | Purpose |
|---|---|
| `maplibre-gl` | Vector map renderer |
| `pmtiles` | Single-file offline tile archive + protocol |
| `@maplibre/maplibre-gl-style-spec` | (optional) style helpers |

### Backend / data

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Auth + REST + realtime |
| (server) PostGIS via Supabase | Geospatial queries (`ST_DWithin`, etc.) |

### Offline / PWA

| Package | Purpose |
|---|---|
| `vite-plugin-pwa` | Workbox service worker generation |
| `workbox-window` | SW registration from the app |
| `idb` | Promise-friendly IndexedDB |

### Styling & icons

| Package | Purpose |
|---|---|
| `tailwindcss` · `@tailwindcss/vite` | Utility CSS (v4) |
| `lucide-react` | Icons (search, layers, hospital, etc.) |
| `clsx` / `tailwind-merge` | Class composition |

### Routing & charts (later screens)

| Package | Purpose |
|---|---|
| `react-router-dom` | Screen navigation (tabs + deep links) |
| `recharts` | Elevation / terrain profile chart |

### Dev / tooling

| Package | Purpose |
|---|---|
| `eslint` + TypeScript ESLint | Lint |
| `@types/geojson` | GeoJSON types |

Install (app root):

```bash
npm create vite@latest . -- --template react-ts
npm install maplibre-gl pmtiles @supabase/supabase-js idb lucide-react clsx tailwind-merge react-router-dom recharts workbox-window
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa @types/geojson
```

---

## 4. PMTiles Generation Pipeline

Goal: produce a **single `.pmtiles` file** from an OpenStreetMap extract so the app can serve tiles without a tile server (HTTP range requests or local file / IndexedDB cache).

### 4.1 Prerequisites (host / CI / VPS)

- [`tippecanoe`](https://github.com/felt/tippecanoe) — or Planetiler
- [`tilemaker`](https://github.com/systemed/tilemaker) **or** [Planetiler](https://github.com/onthegomap/planetiler) (recommended for OSM → MBTiles/PMTiles)
- [`pmtiles` CLI](https://github.com/protomaps/go-pmtiles) (`go install` / release binary)
- [`osmium-tool`](https://osmcode.org/osmium-tool/) — clip / filter extracts
- Optional: [Protomaps basemaps](https://github.com/protomaps/basemaps) build for a known style

### 4.2 Step-by-step

```bash
# 1) Download a regional OSM extract (Geofabrik example)
wget https://download.geofabrik.de/north-america/us/colorado-latest.osm.pbf \
  -O data/colorado-latest.osm.pbf

# 2) Optional: clip to a bounding box (lon/lat)
osmium extract -b -105.6,39.5,-104.6,40.2 \
  data/colorado-latest.osm.pbf \
  -o data/denver-metro.osm.pbf

# 3) Build tiles with Planetiler (outputs .pmtiles directly in recent builds)
java -Xmx4g -jar planetiler.jar \
  --download \
  --area=us/colorado \
  --bounds=-105.6,39.5,-104.6,40.2 \
  --output=public/tiles/denver.pmtiles

# Alternative: tilemaker → MBTiles, then convert
# tilemaker denver-metro.osm.pbf --output=denver.mbtiles
# pmtiles convert denver.mbtiles public/tiles/denver.pmtiles

# 4) Inspect archive
pmtiles show public/tiles/denver.pmtiles
```

### 4.3 Serving PMTiles

- **Dev:** place file under `public/tiles/` and reference `pmtiles:///tiles/denver.pmtiles` after registering the MapLibre protocol from the `pmtiles` package.
- **Prod:** serve the file from nginx / object storage with **HTTP Range** support (`Accept-Ranges: bytes`). nginx must not buffer range requests incorrectly.
- **Offline:** cache the `.pmtiles` blob (or tile ranges) via Workbox / IndexedDB after user selects a download region.

### 4.4 Style

Use a free style compatible with your tile schema, e.g. Protomaps `light` / `dark` JSON pointing at the `pmtiles://` source, or OpenMapTiles-compatible styles if you built with that schema.

Helper script: `scripts/generate-pmtiles.sh` (wraps download → clip → Planetiler → copy into `public/tiles`).

---

## 5. Supabase Schema (PostGIS)

### 5.1 Enable extensions

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm; -- optional text search
```

### 5.2 Enums & facilities table

```sql
create type facility_category as enum (
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
  'comms'
);

create type facility_status as enum (
  'open',
  'limited',
  'closed',
  'unknown'
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category facility_category not null,
  status facility_status not null default 'unknown',
  capacity integer,                    -- people / beds / liters as applicable
  capacity_unit text,                  -- e.g. 'beds', 'people', 'liters'
  phone text,
  website text,
  address text,
  resources jsonb default '[]'::jsonb, -- e.g. ["generator","water","medical"]
  notes text,
  geom geometry(Point, 4326) not null,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index facilities_geom_gix on public.facilities using gist (geom);
create index facilities_category_idx on public.facilities (category);
create index facilities_status_idx on public.facilities (status);
create index facilities_name_trgm on public.facilities using gin (name gin_trgm_ops);
```

### 5.3 RPC: nearby facilities

```sql
create or replace function public.nearby_facilities(
  lat double precision,
  lng double precision,
  radius_m double precision default 5000,
  categories facility_category[] default null
)
returns table (
  id uuid,
  name text,
  category facility_category,
  status facility_status,
  capacity integer,
  capacity_unit text,
  phone text,
  address text,
  resources jsonb,
  last_updated timestamptz,
  distance_m double precision,
  lng double precision,
  lat double precision
)
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.category,
    f.status,
    f.capacity,
    f.capacity_unit,
    f.phone,
    f.address,
    f.resources,
    f.last_updated,
    st_distance(f.geom::geography, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m,
    st_x(f.geom) as lng,
    st_y(f.geom) as lat
  from public.facilities f
  where st_dwithin(
    f.geom::geography,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography,
    radius_m
  )
  and (categories is null or f.category = any (categories))
  order by distance_m;
$$;
```

### 5.4 Offline regions metadata (optional)

```sql
create table public.offline_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bbox box2d not null,           -- or store as geometry Polygon
  min_zoom int not null default 0,
  max_zoom int not null default 14,
  size_bytes bigint,
  pmtiles_url text,
  created_at timestamptz not null default now()
);
```

Migration file: `supabase/migrations/001_facilities.sql`

### 5.5 Row Level Security (starter)

```sql
alter table public.facilities enable row level security;

create policy "Public read facilities"
  on public.facilities for select
  using (true);

-- Authenticated inserts/updates for status reports (tighten later)
create policy "Auth update status"
  on public.facilities for update
  to authenticated
  using (true)
  with check (true);
```

---

## 6. Local Development Setup

### 6.1 Clone & install

```bash
git clone <repo-url> resilience-maps
cd resilience-maps
cp .env.example .env.local
npm install
```

### 6.2 Environment

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_PMTILES_URL=/tiles/denver.pmtiles
VITE_MAP_STYLE_URL=/styles/resilience-light.json
VITE_DEFAULT_CENTER_LNG=-104.9903
VITE_DEFAULT_CENTER_LAT=39.7392
VITE_DEFAULT_ZOOM=11
```

Without Supabase credentials, the app falls back to `src/data/mockFacilities.ts`.

### 6.3 Optional: local Supabase

```bash
npx supabase start
npx supabase db reset   # applies migrations/
```

Copy local API URL + anon key into `.env.local`.

### 6.4 Optional: local PMTiles

Follow [§4](#4-pmtiles-generation-pipeline) and place the file at `public/tiles/….pmtiles`, or use a remote Protomaps demo URL for basemap prototyping.

### 6.5 Run

```bash
npm run dev
```

Open `http://localhost:5173`. Service worker is typically disabled or in generateSW mode for production builds; use `npm run build && npm run preview` to test PWA caching.

### 6.6 Quality checks

```bash
npm run lint
npm run build
```

---

## 7. VPS Deployment (Docker + nginx)

### 7.1 Build image

`docker/Dockerfile` multi-stage:

1. **Builder:** `node:22-alpine` → `npm ci` → `npm run build`
2. **Runtime:** `nginx:alpine` → copy `dist/` + `nginx.conf` (+ optional `tiles/*.pmtiles`)

### 7.2 nginx essentials

- SPA fallback: `try_files $uri $uri/ /index.html;`
- **Range requests** for PMTiles: default nginx supports `Accept-Ranges` for static files
- Long cache for hashed assets; shorter / immutable for `.pmtiles`
- gzip / brotli for JS/CSS (not for already-compressed pmtiles)

### 7.3 Compose

```bash
cd docker
docker compose up -d --build
```

Exposes port `8080` (or `80`) → nginx serving the SPA and `/tiles/`.

### 7.4 TLS (recommended)

Put Caddy or host nginx as reverse proxy with Let’s Encrypt in front of the container, or mount certs into nginx.

### 7.5 Updates

```bash
git pull
docker compose up -d --build
```

Seed / migrate Supabase separately (`supabase db push` or SQL editor).

---

## 8. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | No* | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | No* | Anon/public key |
| `VITE_PMTILES_URL` | No | Path or URL to `.pmtiles` |
| `VITE_MAP_STYLE_URL` | No | Map style JSON URL |
| `VITE_DEFAULT_CENTER_LNG` | No | Initial map longitude |
| `VITE_DEFAULT_CENTER_LAT` | No | Initial map latitude |
| `VITE_DEFAULT_ZOOM` | No | Initial zoom |

\*App runs with mock facilities if unset.

---

## 9. Implementation Order

1. **Scaffold** Vite + React + TS + Tailwind + design tokens (`#1A73E8`)
2. **Explore map** — `MapView` + PMTiles protocol stub / free basemap fallback
3. **Category chips** — filter facility layers / markers
4. **Layers drawer** — terrain / satellite / categories / offline regions toggles
5. Bottom tab bar + my-location + route FAB
6. Filter sheet + POI detail sheet
7. Routes screen + elevation profile + caution banner
8. Offline downloads screen + bbox selector + size estimate
9. Supabase wiring + Workbox caching strategies
10. Docker / nginx production packaging

**Current scaffold focus (v0.1):** Explore map screen, category filter chips, and layers drawer — matching patterns **1.1** and **1.2**.

---

## Design Tokens (Tailwind)

```css
--color-primary: #1A73E8;
--color-surface: #ffffff;
--radius-card: 1rem; /* rounded-2xl */
--shadow-float: 0 2px 8px rgba(60, 64, 67, 0.15), 0 1px 2px rgba(60, 64, 67, 0.3);
```

Visual language: clean Maps-like white floating controls, soft shadows, blue primary actions — not purple gradients or dark-first chrome.
```
