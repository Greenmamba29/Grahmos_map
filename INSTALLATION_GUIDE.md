# Resilience Maps — Installation & Build Guide

**Resilience Maps** is an offline-first, Google-Maps-style web app for locating critical
infrastructure — hospitals, schools, shelters, water sources, power and comms towers —
during connectivity outages. It uses terrain-aware offline vector tiles (PMTiles),
Supabase + PostGIS for facility data, and a Workbox service worker + IndexedDB so the
app keeps working when the network does not.

This guide enumerates **every screen and component**, the **file/folder structure**,
**required npm packages**, the **PMTiles generation pipeline** from OpenStreetMap
extracts, the **Supabase schema**, and **step-by-step local + VPS deployment**
instructions (Docker + nginx).

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Screens & components (the 6 reference patterns)](#2-screens--components)
3. [File / folder structure](#3-file--folder-structure)
4. [Required npm packages](#4-required-npm-packages)
5. [PMTiles generation pipeline (OSM → offline tiles)](#5-pmtiles-generation-pipeline)
6. [Supabase schema (PostGIS)](#6-supabase-schema-postgis)
7. [Offline strategy (Workbox + IndexedDB)](#7-offline-strategy)
8. [Local development setup](#8-local-development-setup)
9. [VPS deployment (Docker + nginx)](#9-vps-deployment-docker--nginx)
10. [Environment variables reference](#10-environment-variables-reference)

---

## 1. Architecture overview

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (PWA)                                                 │
│                                                                │
│  React + TypeScript UI (Tailwind, Google-Maps visual language) │
│      │                                                         │
│  MapLibre GL JS  ──►  pmtiles:// protocol  ──►  region.pmtiles │
│      │                    (single file, HTTP range requests,   │
│      │                     fully cacheable for offline use)    │
│      │                                                         │
│  Workbox service worker                                        │
│    • precache: app shell (JS/CSS/HTML/fonts/sprites/glyphs)    │
│    • runtime: CacheFirst for tile range requests               │
│      │                                                         │
│  IndexedDB (idb)                                               │
│    • facilities snapshot (per downloaded region)               │
│    • saved places, offline region metadata, status reports     │
│      │  (queued mutations sync when back online)               │
└──────┼─────────────────────────────────────────────────────────┘
       │ online only
┌──────▼─────────────────────────────────────────────────────────┐
│  Supabase                                                      │
│    • Postgres + PostGIS: facilities, facility_reports,         │
│      offline_regions, alerts                                   │
│    • RPC: facilities_in_bbox, facilities_nearby (KNN)          │
│    • Realtime: status change broadcasts → Alerts tab           │
└────────────────────────────────────────────────────────────────┘
```

Key decisions:

- **PMTiles** — a single-file archive of vector tiles read via HTTP range requests.
  No tile server needed; nginx (or any static host) serves it. The service worker
  caches range responses, so a downloaded region renders with zero connectivity.
- **Offline-first data** — facility data for a downloaded region is snapshotted into
  IndexedDB. All reads go through a repository layer that prefers IndexedDB and
  refreshes from Supabase when online.
- **Terrain-aware** — a `terrain` raster-dem source (terrarium-encoded PMTiles) powers
  hillshade, the elevation profile chart on the Routes screen, and steepness warnings.

---

## 2. Screens & components

Visual language throughout: white cards, `rounded-2xl` corners, soft shadows
(`shadow-md`/custom), blue primary accent `#1A73E8`, Google-Sans-like font stack.

### Pattern 1 — Home / Explore screen (`src/screens/ExploreScreen.tsx`)

Google Maps' home screen, repurposed:

| Component | File | Notes |
|---|---|---|
| Full-bleed map | `components/map/MapView.tsx` | MapLibre GL, PMTiles protocol registered once |
| Floating search bar | `components/explore/SearchBar.tsx` | Rounded pill, search icon, mic icon, profile avatar; searches facility names offline |
| Category chips | `components/explore/CategoryChips.tsx` | Horizontal scroll: **Hospitals / Schools / Shelters / Water / Power / Comms** (replaces Restaurants/Hotels/Coffee); each chip has icon + color, toggles map filter |
| Facility markers | `components/map/FacilityMarkers.tsx` | Category-colored pins with status ring (operational = green, degraded = amber, down = red, unknown = gray) |
| My-location button | `components/map/LocateButton.tsx` | Small floating circle, bottom-right, above the FAB |
| Directions FAB | `components/map/DirectionsFab.tsx` | Larger primary blue circular FAB → opens Routes |
| Bottom tab bar | `components/shell/BottomTabBar.tsx` | **Explore / Routes / Saved / Offline / Alerts** (replaces Explore/Go/Saved/Contribute/Updates) |
| Offline banner | `components/shell/OfflineBanner.tsx` | Slim banner when `navigator.onLine === false`: "Offline — showing downloaded data" |

### Pattern 2 — Layers control (`components/map/LayersButton.tsx` + `LayersDrawer.tsx`)

- Small circular stacked-squares icon floating **top-right** of the map.
- Opens a drawer (right-side sheet on desktop, bottom sheet on mobile) with:
  - **Map type**: Default / Terrain / Satellite (thumbnail tiles, selected = blue ring)
  - **Details** toggles: facility categories (one switch per category), hillshade,
    contour lines
  - **Offline** toggle: show downloaded-region overlay (dashed bounding boxes on map)

### Pattern 3 — Filter panel (`components/explore/FilterSheet.tsx`)

Slide-up sheet (like Maps' price/rating filter):

- Pill-style multi-select toggles: **Open now / Verified < 24 h / Has power /
  Has water / Wheelchair accessible**
- Sort-by segmented control: **Distance / Capacity / Last verified**
- Range slider (`components/ui/RangeSlider.tsx`): repurposed from "price" to
  **Distance radius (0.5 – 50 km)** and **Minimum capacity (people)**
- Sticky footer: `Clear` text button + primary `Apply` button

### Pattern 4 — POI detail card (`components/poi/PoiSheet.tsx`)

Bottom sheet, three snap points (peek / half / full):

- **Header**: facility name, category badge, status chip, "last verified 2 h ago"
- **Action pills** (`components/poi/ActionPills.tsx`):
  **Directions / Report Status / Save / Call** (replaces Directions/Share/Save/Website)
- **Tabs** (`components/ui/Tabs.tsx`): **Overview / Capacity / Resources / Updates**
  (replaces Overview/Photos/Reviews)
  - *Overview*: address, distance, operating org, notes
  - *Capacity*: capacity bar (current occupancy vs max), beds/seats breakdown
  - *Resources*: checklist of available resources (water, generator, medical, radio)
  - *Updates*: chronological status reports from `facility_reports`
- **Report Status modal** (`components/poi/ReportStatusModal.tsx`): pick
  operational/degraded/down + note; queues to IndexedDB outbox when offline.

### Pattern 5 — Route / Directions screen (`src/screens/RoutesScreen.tsx`)

- Top **map preview** with route polyline (blue casing, Google-style)
- **Mode tabs**: Walk / Bike / Drive (walk is the resilience default)
- **ETA + distance row**: big blue ETA, distance, ascent/descent totals
- **Elevation / terrain profile chart** (`components/route/ElevationProfile.tsx`):
  SVG area chart from sampled DEM values; steep segments (> 15 %) highlighted amber —
  critical for terrain-aware routing around hazards
- **Caution banner** (`components/route/CautionBanner.tsx`): amber
  "Route may be blocked or unverified — conditions reported 3 h ago"
  (repurposes Maps' "conditions may vary" pattern)
- **Numbered turn-by-turn steps** (`components/route/StepsList.tsx`)
- Bottom sticky **Preview / Show map** buttons

### Pattern 6 — Offline downloads screen (`src/screens/OfflineScreen.tsx`)

- Prominent **"See what you can download"** CTA card at top
- List of downloaded regions (`components/offline/RegionCard.tsx`): name, area,
  **size in MB**, downloaded date, per-item status icon
  (✓ downloaded / ⟳ updating / ⚠ update available / ⬇ in-progress with progress ring)
- **Region selector** (`components/offline/RegionSelectModal.tsx`): full-screen map
  with a draggable/resizable **bounding-box selector** and a **live size estimate**
  ("≈ 38 MB · tiles + 214 facilities") that updates as the box changes
- Per-region overflow menu: Rename / Update now / Delete
- Storage summary footer: "142 MB of ~2 GB used"

### Cross-cutting screens

| Screen | File | Contents |
|---|---|---|
| Saved | `src/screens/SavedScreen.tsx` | Lists (Emergency plan, Family meetup, Starred), saved facilities with category icons |
| Alerts | `src/screens/AlertsScreen.tsx` | Feed of status changes & broadcast alerts, unread dot on tab icon |

---

## 3. File / folder structure

```
resilience-maps/
├── INSTALLATION_GUIDE.md
├── README.md
├── package.json
├── vite.config.ts               # React + Tailwind + vite-plugin-pwa (Workbox)
├── tsconfig.json
├── index.html
├── .env.example
├── docker/
│   ├── Dockerfile               # multi-stage: node build → nginx serve
│   ├── nginx.conf               # SPA fallback, range-request + CORS for .pmtiles
│   └── docker-compose.yml
├── scripts/
│   ├── make-pmtiles.sh          # OSM extract → region.pmtiles (tilemaker/planetiler)
│   └── seed-facilities.sql      # demo facility rows
├── supabase/
│   └── migrations/
│       └── 0001_init.sql        # PostGIS schema + RPCs + RLS
├── public/
│   ├── manifest.webmanifest
│   ├── icons/
│   └── tiles/                   # place region.pmtiles + terrain.pmtiles here
└── src/
    ├── main.tsx
    ├── App.tsx                  # shell: screen switch + bottom tabs
    ├── index.css                # Tailwind + design tokens
    ├── types.ts                 # Facility, RouteStep, OfflineRegion, ...
    ├── config.ts                # env access, map style URLs, constants
    ├── data/
    │   ├── supabaseClient.ts
    │   ├── facilitiesRepo.ts    # offline-first repository (IndexedDB ⇄ Supabase)
    │   ├── idb.ts               # IndexedDB stores (facilities, regions, outbox, saved)
    │   └── demoData.ts          # seed data so the app runs with no backend
    ├── hooks/
    │   ├── useOnlineStatus.ts
    │   ├── useGeolocation.ts
    │   └── useFacilities.ts
    ├── store/
    │   └── appStore.ts          # zustand: filters, layers, selection, tab
    ├── map/
    │   ├── styleFactory.ts      # builds MapLibre style (default/terrain/satellite)
    │   └── pmtilesProtocol.ts   # registers pmtiles:// once
    ├── screens/
    │   ├── ExploreScreen.tsx
    │   ├── RoutesScreen.tsx
    │   ├── SavedScreen.tsx
    │   ├── OfflineScreen.tsx
    │   └── AlertsScreen.tsx
    └── components/
        ├── shell/   (BottomTabBar, OfflineBanner)
        ├── map/     (MapView, FacilityMarkers, LocateButton, DirectionsFab,
        │             LayersButton, LayersDrawer)
        ├── explore/ (SearchBar, CategoryChips, FilterSheet)
        ├── poi/     (PoiSheet, ActionPills, ReportStatusModal, tabs content)
        ├── route/   (ElevationProfile, CautionBanner, StepsList, ModeTabs)
        ├── offline/ (RegionCard, RegionSelectModal, StorageSummary)
        └── ui/      (BottomSheet, Tabs, RangeSlider, Pill, Switch, Icon)
```

---

## 4. Required npm packages

Runtime:

| Package | Why |
|---|---|
| `react`, `react-dom` | UI |
| `maplibre-gl` | Map renderer (WebGL vector tiles) |
| `pmtiles` | `pmtiles://` protocol adapter for MapLibre — single-file offline tiles |
| `@supabase/supabase-js` | Facilities API, auth, realtime alerts |
| `zustand` | Small global store (filters, layers, selection) |
| `idb` | Promise-based IndexedDB wrapper |

Dev / build:

| Package | Why |
|---|---|
| `typescript`, `vite`, `@vitejs/plugin-react` | Build toolchain |
| `tailwindcss`, `@tailwindcss/vite` | Styling (v4, zero-config) |
| `vite-plugin-pwa`, `workbox-window` | Workbox service worker: precache + runtime tile caching |
| `@types/react`, `@types/react-dom` | Types |

Install everything:

```bash
npm install react react-dom maplibre-gl pmtiles @supabase/supabase-js zustand idb
npm install -D typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite \
  vite-plugin-pwa workbox-window @types/react @types/react-dom
```

---

## 5. PMTiles generation pipeline

Goal: one `region.pmtiles` (basemap vectors) + one `terrain.pmtiles` (raster-DEM)
per deployable region. No tile server — nginx serves the files statically and the
browser fetches byte ranges.

### 5.1 Basemap vectors from an OSM extract

```bash
# 1. Download an OSM extract for your region (Geofabrik)
wget https://download.geofabrik.de/north-america/us/california-latest.osm.pbf

# 2. Generate tiles with Planetiler (Java 21+; OpenMapTiles-compatible schema)
wget https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar
java -Xmx4g -jar planetiler.jar \
  --osm-path=california-latest.osm.pbf \
  --output=region.pmtiles \
  --bounds=-122.75,37.20,-121.75,38.05 \        # clip to your service area
  --maxzoom=14

# Alternative: tilemaker (C++) → .mbtiles, then convert:
#   tilemaker --input region.osm.pbf --output region.mbtiles
#   pmtiles convert region.mbtiles region.pmtiles      # go-pmtiles CLI

# 3. Inspect
pmtiles show region.pmtiles
```

### 5.2 Terrain DEM tiles (for hillshade + elevation profiles)

```bash
# Terrarium-encoded elevation PNGs from AWS Terrain Tiles → pmtiles
# (or download a prebuilt DEM pmtiles, e.g. from Protomaps builds)
pmtiles extract https://build.protomaps.com/terrain.pmtiles terrain.pmtiles \
  --bbox=-122.75,37.20,-121.75,38.05
```

### 5.3 Ship it

```bash
cp region.pmtiles terrain.pmtiles public/tiles/
```

Set in `.env`:

```
VITE_BASEMAP_PMTILES_URL=/tiles/region.pmtiles
VITE_TERRAIN_PMTILES_URL=/tiles/terrain.pmtiles
```

The app's style factory (`src/map/styleFactory.ts`) automatically uses
`pmtiles://` sources when these are set, and falls back to a free public style
(OpenFreeMap) for development when they are not.

> **Serving note:** the host must support HTTP `Range` requests (nginx does out of
> the box) and expose `ETag`/`Accept-Ranges` headers. The provided
> `docker/nginx.conf` handles this plus CORS.

---

## 6. Supabase schema (PostGIS)

Apply `supabase/migrations/0001_init.sql` via `supabase db push` or the SQL editor:

```sql
create extension if not exists postgis;

-- Facility categories and statuses
create type facility_category as enum
  ('hospital','school','shelter','water','power','comms');
create type facility_status as enum
  ('operational','degraded','down','unknown');

create table public.facilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      facility_category not null,
  geom          geometry(Point, 4326) not null,
  address       text,
  phone         text,
  capacity      integer,                 -- people (shelter beds, seats, ...)
  occupancy     integer,                 -- current, if known
  resources     jsonb not null default '{}'::jsonb,  -- {water:true,generator:true,...}
  status        facility_status not null default 'unknown',
  status_note   text,
  last_updated  timestamptz not null default now(),
  verified_by   text
);

create index facilities_geom_gix on public.facilities using gist (geom);
create index facilities_category_idx on public.facilities (category);

-- Crowd-sourced status reports (Report Status action on the POI card)
create table public.facility_reports (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities(id) on delete cascade,
  status       facility_status not null,
  note         text,
  reporter     text,
  created_at   timestamptz not null default now()
);

-- Downloadable offline region definitions (curated)
create table public.offline_regions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  bbox        geometry(Polygon, 4326) not null,
  tiles_url   text not null,            -- URL of the region .pmtiles
  size_mb     numeric not null,
  updated_at  timestamptz not null default now()
);

-- Broadcast alerts (Alerts tab)
create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  severity    text not null check (severity in ('info','warning','critical')),
  area        geometry(Polygon, 4326),
  created_at  timestamptz not null default now()
);

-- Keep facilities.last_updated / status in sync with the newest report
create or replace function public.apply_report() returns trigger as $$
begin
  update public.facilities
     set status = new.status,
         status_note = new.note,
         last_updated = new.created_at
   where id = new.facility_id;
  return new;
end $$ language plpgsql security definer;

create trigger trg_apply_report
  after insert on public.facility_reports
  for each row execute function public.apply_report();

-- Geospatial RPCs -----------------------------------------------------------

-- Everything inside a bounding box (used for region download snapshots)
create or replace function public.facilities_in_bbox(
  min_lng float8, min_lat float8, max_lng float8, max_lat float8)
returns setof public.facilities language sql stable as $$
  select * from public.facilities
  where geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;

-- K nearest facilities, optionally by category (uses GiST KNN <->)
create or replace function public.facilities_nearby(
  lng float8, lat float8, max_km float8 default 25,
  cat facility_category default null, lim int default 50)
returns table (like public.facilities, distance_m float8)
language sql stable as $$
  select f.*, st_distance(f.geom::geography,
         st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m
  from public.facilities f
  where (cat is null or f.category = cat)
    and st_dwithin(f.geom::geography,
        st_setsrid(st_makepoint(lng, lat), 4326)::geography, max_km * 1000)
  order by f.geom <-> st_setsrid(st_makepoint(lng, lat), 4326)
  limit lim;
$$;

-- RLS: public read, authenticated report writes
alter table public.facilities enable row level security;
alter table public.facility_reports enable row level security;
alter table public.offline_regions enable row level security;
alter table public.alerts enable row level security;

create policy "public read facilities" on public.facilities for select using (true);
create policy "public read regions" on public.offline_regions for select using (true);
create policy "public read alerts" on public.alerts for select using (true);
create policy "public read reports" on public.facility_reports for select using (true);
create policy "anyone can report" on public.facility_reports for insert with check (true);
```

Seed demo rows with `scripts/seed-facilities.sql`.

---

## 7. Offline strategy

1. **App shell** — `vite-plugin-pwa` (Workbox `generateSW`) precaches all built
   JS/CSS/HTML/fonts/sprite assets on first visit. The app boots with zero network.
2. **Tiles** — PMTiles range requests are cached with a `CacheFirst` runtime route
   (`urlPattern: /\.pmtiles/`, `rangeRequests: true`). "Download region" additionally
   walks the tile pyramid inside the chosen bbox and warms the cache deliberately.
3. **Data** — `facilitiesRepo` reads IndexedDB first, then refreshes from Supabase
   when online. "Download region" calls `facilities_in_bbox` and snapshots rows into
   the `facilities` store keyed by region id.
4. **Mutations** — status reports created offline are written to an `outbox` store
   and flushed to Supabase on `online` events (last-write-wins).
5. **UI truth** — `useOnlineStatus` drives the OfflineBanner and disables
   online-only actions (e.g., new region download) gracefully.

---

## 8. Local development setup

```bash
# 0. Prereqs: Node 20+, npm 10+
git clone <repo> && cd resilience-maps
npm install

# 1. Environment
cp .env.example .env
#    - leave Supabase vars empty to run on bundled demo data
#    - set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to go live

# 2. (Optional) real offline tiles — see §5, then drop the files in public/tiles/

# 3. (Optional) Supabase
supabase init && supabase start          # or use a hosted project
supabase db push                         # applies supabase/migrations
psql "$DB_URL" -f scripts/seed-facilities.sql

# 4. Run
npm run dev                              # http://localhost:5173

# 5. Production build + preview (service worker active in preview)
npm run build && npm run preview
```

Testing offline: open DevTools → Network → "Offline" after one full load; the app
shell, cached tiles, and IndexedDB facilities keep working.

---

## 9. VPS deployment (Docker + nginx)

Files live in `docker/`. The image is multi-stage: Node builds the static bundle,
nginx serves it with SPA fallback, long-cache immutable assets, and correct
range-request handling for `.pmtiles`.

```bash
# On the VPS (Ubuntu 22.04+)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
git clone <repo> && cd resilience-maps

# Build-time env (baked into the static bundle)
cp .env.example .env && nano .env

# Put your generated tiles where the image build can copy them
cp /path/to/region.pmtiles /path/to/terrain.pmtiles public/tiles/

docker compose -f docker/docker-compose.yml up -d --build
# → serves on port 80
```

TLS (recommended — geolocation and service workers require HTTPS in production):

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d maps.example.org
# mount /etc/letsencrypt into the container and enable the ssl server block
# in docker/nginx.conf, then: docker compose restart
```

`docker/nginx.conf` highlights:

- `try_files $uri /index.html;` — SPA fallback
- `location ~* \.pmtiles$` — `Accept-Ranges: bytes`, CORS `*`, no gzip (already
  compressed), `Cache-Control: public, max-age=86400`
- hashed assets under `/assets/` get `Cache-Control: immutable`
- `sw.js` and `index.html` are `no-cache` so updates roll out promptly

Updating a deployment:

```bash
git pull && docker compose -f docker/docker-compose.yml up -d --build
```

---

## 10. Environment variables reference

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | no (demo mode without it) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | no | Supabase anon key |
| `VITE_BASEMAP_PMTILES_URL` | no | Path/URL to basemap `.pmtiles`; falls back to OpenFreeMap public style |
| `VITE_TERRAIN_PMTILES_URL` | no | Path/URL to terrain raster-dem `.pmtiles` |
| `VITE_DEFAULT_CENTER` | no | `lng,lat` initial view (default San Francisco) |
| `VITE_DEFAULT_ZOOM` | no | Initial zoom (default 13) |
