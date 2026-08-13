# Resilience Maps — Installation & Build Guide

Resilience Maps is an **offline-first mapping web app** for locating critical infrastructure
(hospitals, schools, shelters, water sources, comms towers, power) during connectivity
outages. It uses terrain-aware offline vector tiles (PMTiles), a PostGIS-backed facility
registry, and a Workbox service worker so the entire app keeps working with the network
completely down.

This document is the specification the project is built against. It enumerates every
screen and component, the file layout, the packages, the PMTiles generation pipeline,
the Supabase schema, and step-by-step local and VPS deployment.

---

## Table of contents

1. [Design language](#1-design-language)
2. [Screen & component inventory](#2-screen--component-inventory)
3. [File & folder structure](#3-file--folder-structure)
4. [Required npm packages](#4-required-npm-packages)
5. [Local setup](#5-local-setup)
6. [Environment variables](#6-environment-variables)
7. [PMTiles generation pipeline (OpenStreetMap → offline tiles)](#7-pmtiles-generation-pipeline-openstreetmap--offline-tiles)
8. [Terrain tiles (offline hillshade / elevation)](#8-terrain-tiles-offline-hillshade--elevation)
9. [Supabase schema (PostGIS)](#9-supabase-schema-postgis)
10. [Offline architecture](#10-offline-architecture)
11. [Routing & elevation profile](#11-routing--elevation-profile)
12. [Build & quality gates](#12-build--quality-gates)
13. [VPS deployment (Docker + nginx)](#13-vps-deployment-docker--nginx)
14. [Operations runbook](#14-operations-runbook)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Design language

The UI follows the Google Maps iOS visual language, adapted for emergency-response use.

| Token | Value | Usage |
| --- | --- | --- |
| `--color-primary` | `#1A73E8` | Primary accent, active states, route line |
| `--color-primary-dark` | `#1557B0` | Pressed states |
| `--color-surface` | `#FFFFFF` | Cards, sheets, chips |
| `--color-ink` | `#202124` | Primary text |
| `--color-ink-muted` | `#5F6368` | Secondary text, icons |
| `--color-hairline` | `#DADCE0` | Borders, dividers |
| `--color-critical` | `#D93025` | Closed / hazard / blocked |
| `--color-warning` | `#F9AB00` | Limited capacity, unverified |
| `--color-success` | `#188038` | Open / verified |

Rules of thumb:

- Floating surfaces are white, `rounded-2xl` (search bar and sheets use `rounded-3xl`),
  with a soft two-layer shadow (`shadow-map`), never a hard border.
- Controls are circular (`rounded-full`) when they hold a single icon.
- Bottom sheets snap to three heights: peek (~120px), half (~55vh), full (~92vh).
- Tap targets are ≥ 44px. The whole layout is mobile-first; ≥ `md` widens sheets into a
  left-hand rail so the map stays visible.
- Everything must be legible in direct sunlight: high contrast, no low-opacity grey text
  below `--color-ink-muted`.

## 2. Screen & component inventory

Six reference patterns from Google Maps iOS drive the build. Each is listed with the
components to implement and the file that owns it.

### Pattern 1 — Home / Explore screen

Full-bleed map with floating chrome on top.

| Component | File | Notes |
| --- | --- | --- |
| `ExploreScreen` | `src/screens/ExploreScreen.tsx` | Composes the map + all floating chrome |
| `MapCanvas` | `src/components/map/MapCanvas.tsx` | MapLibre instance, PMTiles protocol, terrain |
| `SearchBar` | `src/components/explore/SearchBar.tsx` | Floating rounded pill, leading search icon, trailing mic + avatar; opens `SearchSheet` |
| `SearchSheet` | `src/components/explore/SearchSheet.tsx` | Full-screen results list, offline-capable (queries the local index) |
| `CategoryChips` | `src/components/explore/CategoryChips.tsx` | Horizontal scroller: Hospitals / Schools / Shelters / Water / Power / Comms. Active chip fills with primary |
| `MyLocationButton` | `src/components/explore/MyLocationButton.tsx` | Small circular FAB, bottom-right above the primary FAB |
| `RouteFab` | `src/components/explore/RouteFab.tsx` | Larger primary FAB (directions arrow) → Routes screen |
| `BottomTabBar` | `src/components/shell/BottomTabBar.tsx` | Explore / Routes / Saved / Offline / Alerts |
| `OfflineBanner` | `src/components/shell/OfflineBanner.tsx` | Slides under the search bar when `navigator.onLine === false`, shows tile-cache freshness |
| `FacilityMarkers` | `src/components/map/FacilityMarkers.tsx` | GeoJSON source + clustered symbol layers, one colour per category, status ring |

### Pattern 2 — Layers control

| Component | File | Notes |
| --- | --- | --- |
| `LayersButton` | `src/components/map/LayersButton.tsx` | Circular stacked-square icon, floats top-right under the search bar |
| `LayersDrawer` | `src/components/map/LayersDrawer.tsx` | Sheet with a 2-up grid of basemap cards (Default / Terrain / Satellite) plus toggle rows: Hillshade, Facility categories, Downloaded regions overlay, Hazard zones |
| `MapTypeCard` | `src/components/map/MapTypeCard.tsx` | Thumbnail + label + selected ring |
| `ToggleRow` | `src/components/ui/ToggleRow.tsx` | Icon + label + `Switch` |

### Pattern 3 — Filter panel

| Component | File | Notes |
| --- | --- | --- |
| `FilterSheet` | `src/components/explore/FilterSheet.tsx` | Slide-up sheet |
| `PillToggle` | `src/components/ui/PillToggle.tsx` | Open now / Verified 24h / Has generator / Wheelchair access / Accepts referrals |
| `SegmentedControl` | `src/components/ui/SegmentedControl.tsx` | Sort by: Distance / Capacity / Recently updated |
| `RangeSlider` | `src/components/ui/RangeSlider.tsx` | Dual-thumb. Repurposes the Maps price slider as **capacity (beds/people)** and **distance (km)** |

### Pattern 4 — POI detail card

| Component | File | Notes |
| --- | --- | --- |
| `FacilitySheet` | `src/components/facility/FacilitySheet.tsx` | Draggable bottom sheet, 3 snap points |
| `StatusRow` | `src/components/facility/StatusRow.tsx` | Status dot + label, category, distance, "verified 2h ago" |
| `ActionPills` | `src/components/facility/ActionPills.tsx` | Directions / Report Status / Save / Call |
| `FacilityTabs` | `src/components/facility/FacilityTabs.tsx` | Overview / Capacity / Resources / Updates |
| `CapacityBar` | `src/components/facility/CapacityBar.tsx` | Occupied vs total, colour-coded |
| `ResourceList` | `src/components/facility/ResourceList.tsx` | Power, water, oxygen, fuel, beds — availability chips |
| `UpdateFeed` | `src/components/facility/UpdateFeed.tsx` | Field reports, newest first, "queued for sync" state when offline |
| `ReportStatusSheet` | `src/components/facility/ReportStatusSheet.tsx` | Writes to the outbox; syncs when back online |

### Pattern 5 — Route / directions screen

| Component | File | Notes |
| --- | --- | --- |
| `RoutesScreen` | `src/screens/RoutesScreen.tsx` | Map preview on top, scrollable detail below |
| `RouteMapPreview` | `src/components/route/RouteMapPreview.tsx` | Static-ish map with the route line + hazard markers |
| `TravelModeTabs` | `src/components/route/TravelModeTabs.tsx` | Drive / Truck / Foot / Boat |
| `EtaRow` | `src/components/route/EtaRow.tsx` | ETA, distance, ascent, "avoids 2 hazards" |
| `ElevationProfile` | `src/components/route/ElevationProfile.tsx` | SVG area chart of the terrain profile, hazard bands shaded, hover scrubber synced to the map |
| `TurnStepsList` | `src/components/route/TurnStepsList.tsx` | Numbered steps, per-step distance, terrain warning icons |
| `CautionBanner` | `src/components/route/CautionBanner.tsx` | Repurposes "conditions may vary" → "Route may be blocked / unverified since <time>" |
| `RouteActions` | `src/components/route/RouteActions.tsx` | Preview / Show map buttons pinned to the bottom |

### Pattern 6 — Offline downloads screen

| Component | File | Notes |
| --- | --- | --- |
| `OfflineScreen` | `src/screens/OfflineScreen.tsx` | List of downloaded regions |
| `DownloadCta` | `src/components/offline/DownloadCta.tsx` | Prominent "See what you can download" card |
| `RegionCard` | `src/components/offline/RegionCard.tsx` | Name, size in MB, expiry, per-item status icon (downloaded / updating / stale / failed) |
| `RegionPicker` | `src/components/offline/RegionPicker.tsx` | Draggable bounding-box selector on the map with a live size estimate |
| `SizeEstimate` | `src/components/offline/SizeEstimate.tsx` | Bytes estimated from bbox area × zoom range, plus storage-quota bar |
| `StorageMeter` | `src/components/offline/StorageMeter.tsx` | `navigator.storage.estimate()` usage bar |

### Supporting screens

| Screen | File | Notes |
| --- | --- | --- |
| `SavedScreen` | `src/screens/SavedScreen.tsx` | Saved facilities and lists, works fully offline |
| `AlertsScreen` | `src/screens/AlertsScreen.tsx` | Hazard/status alert feed + pending-sync outbox |

## 3. File & folder structure

```
resilience-maps/
├── INSTALLATION_GUIDE.md
├── README.md
├── package.json
├── tsconfig.json  tsconfig.app.json  tsconfig.node.json
├── vite.config.ts                 # React + Tailwind v4 + PWA (Workbox) plugins
├── eslint.config.js
├── index.html
├── Dockerfile                     # multi-stage: node build → nginx
├── docker-compose.yml             # app + optional tile volume
├── deploy/
│   ├── nginx.conf                 # SPA fallback, PMTiles range requests, cache headers
│   └── resilience-maps.service    # optional systemd unit for non-Docker hosts
├── scripts/
│   ├── make-pmtiles.sh            # OSM extract → mbtiles → pmtiles
│   ├── make-terrain.sh            # DEM → terrain-RGB → pmtiles
│   └── seed-supabase.ts           # push seed facilities into PostGIS
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init_postgis.sql
│   │   ├── 0002_facilities.sql
│   │   ├── 0003_rpc_nearby.sql
│   │   └── 0004_rls.sql
│   └── seed/facilities.seed.sql
├── public/
│   ├── manifest.webmanifest
│   ├── styles/                    # MapLibre style JSON (default / terrain / satellite)
│   └── tiles/                     # *.pmtiles live here (git-ignored)
└── src/
    ├── main.tsx  App.tsx  index.css
    ├── app/                       # router, providers, service-worker registration
    ├── screens/                   # one file per screen (see §2)
    ├── components/
    │   ├── shell/                 # BottomTabBar, OfflineBanner, ScreenHeader
    │   ├── map/                   # MapCanvas, layers, markers
    │   ├── explore/               # search, chips, filters, FABs
    │   ├── facility/              # POI detail sheet
    │   ├── route/                 # directions screen parts
    │   ├── offline/               # downloads screen parts
    │   └── ui/                    # BottomSheet, Switch, PillToggle, RangeSlider, …
    ├── hooks/                     # useOnlineStatus, useGeolocation, useFacilities, …
    ├── lib/
    │   ├── supabase.ts            # client (null-safe when unconfigured)
    │   ├── facilities.ts          # repository: network → cache → seed
    │   ├── db.ts                  # IndexedDB (idb) stores
    │   ├── outbox.ts              # queued writes for offline reports
    │   ├── pmtiles.ts             # protocol registration + region download
    │   ├── routing.ts             # local A*/terrain-aware routing + elevation sampling
    │   ├── geo.ts                 # haversine, bbox math, tile-count estimate
    │   └── format.ts              # bytes, distance, relative time
    ├── data/                      # seed facilities + hazards (offline fallback)
    ├── state/                     # zustand stores: mapPrefs, filters, selection, offline
    └── types/                     # shared TS types
```

## 4. Required npm packages

Runtime:

| Package | Why |
| --- | --- |
| `react`, `react-dom` | UI |
| `react-router-dom` | Screen routing (`/`, `/routes`, `/saved`, `/offline`, `/alerts`) |
| `maplibre-gl` | Vector map renderer, terrain, hillshade |
| `pmtiles` | Single-file tile archives; registers the `pmtiles://` protocol |
| `@supabase/supabase-js` | Facility registry + PostGIS RPC |
| `zustand` | Small global stores (map prefs, filters, selection) |
| `idb` | Typed IndexedDB wrapper for the offline cache and outbox |
| `clsx` | Conditional class names |
| `lucide-react` | Icon set matching the Maps line-icon weight |

Dev / build:

| Package | Why |
| --- | --- |
| `vite`, `@vitejs/plugin-react` | Build tooling |
| `typescript`, `typescript-eslint`, `eslint`, `eslint-plugin-react-hooks` | Types & linting |
| `tailwindcss`, `@tailwindcss/vite` | Styling (v4, CSS-first config) |
| `vite-plugin-pwa`, `workbox-window` | Service worker generation + update prompts |
| `@types/react`, `@types/react-dom`, `@types/node` | Types |

External CLI tools (only needed to *generate* tiles, not to run the app):
`osmium-tool`, `tilemaker` **or** `planetiler`, `pmtiles`, `gdal-bin`, `rio-rgbify`.

## 5. Local setup

```bash
git clone <repo-url> resilience-maps
cd resilience-maps

nvm use 22          # Node >= 20.19 required by Vite 7
npm install

cp .env.example .env.local     # optional: fill in Supabase creds
npm run dev                    # http://localhost:5173
```

The app is designed to boot with **zero configuration**: without Supabase credentials or
PMTiles archives it falls back to the bundled seed facility dataset and a raster basemap,
so the UI is fully explorable offline on first run. Add the real data sources when ready.

Scripts:

```bash
npm run dev         # Vite dev server
npm run build       # typecheck + production bundle + service worker
npm run preview     # serve the production build locally (tests the SW)
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

## 6. Environment variables

`.env.example`:

```ini
# Supabase (optional — omit to run entirely on bundled seed data)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Basemap tiles. Local PMTiles is the offline-first default.
VITE_BASEMAP_PMTILES_URL=/tiles/region.pmtiles
VITE_TERRAIN_PMTILES_URL=/tiles/terrain.pmtiles
VITE_SATELLITE_TILES_URL=

# Optional online fallback style used only when a PMTiles archive is absent
VITE_FALLBACK_RASTER_TILES_URL=https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png

# Default map view (lon,lat,zoom)
VITE_DEFAULT_CENTER=-72.3350,18.5392
VITE_DEFAULT_ZOOM=11
```

All are read through `src/lib/config.ts`, which validates and provides defaults so a
missing variable never crashes the app.

## 7. PMTiles generation pipeline (OpenStreetMap → offline tiles)

PMTiles is a single-file, cloud-optimised tile archive read over HTTP range requests —
no tile server, and the same file can be cached whole for offline use.

### 7.1 Install tools

```bash
# macOS
brew install osmium-tool gdal
brew install protomaps/tap/pmtiles

# Debian / Ubuntu
sudo apt-get install -y osmium-tool gdal-bin
curl -L https://github.com/protomaps/go-pmtiles/releases/latest/download/pmtiles_linux_amd64.tar.gz \
  | sudo tar -xz -C /usr/local/bin pmtiles
```

For vector tile building use either:

- **tilemaker** (light, good for country extracts): `brew install tilemaker` /
  build from source on Linux.
- **planetiler** (JVM, fast, planet-scale): download `planetiler.jar`.

### 7.2 Download an extract

```bash
mkdir -p data && cd data
# Country/region extracts from Geofabrik
curl -O https://download.geofabrik.de/central-america/haiti-and-domrep-latest.osm.pbf
```

### 7.3 Clip to your area of operations

```bash
osmium extract \
  --bbox=-72.65,18.40,-72.10,18.70 \
  --set-bounds \
  -o aoi.osm.pbf haiti-and-domrep-latest.osm.pbf
```

### 7.4 Build vector tiles, then convert to PMTiles

With planetiler (recommended, emits `.pmtiles` directly):

```bash
java -Xmx8g -jar planetiler.jar \
  --osm-path=aoi.osm.pbf \
  --output=region.pmtiles \
  --force \
  --minzoom=0 --maxzoom=14
```

With tilemaker (emits MBTiles, then convert):

```bash
tilemaker --input aoi.osm.pbf --output region.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua
pmtiles convert region.mbtiles region.pmtiles
```

Verify and inspect:

```bash
pmtiles show region.pmtiles          # bounds, zooms, tile count, size
pmtiles serve . --port 8080          # quick local check
```

### 7.5 Publish

```bash
mkdir -p ../public/tiles
mv region.pmtiles ../public/tiles/region.pmtiles
```

`scripts/make-pmtiles.sh` wraps steps 7.2–7.5:

```bash
./scripts/make-pmtiles.sh \
  --pbf-url https://download.geofabrik.de/central-america/haiti-and-domrep-latest.osm.pbf \
  --bbox -72.65,18.40,-72.10,18.70 \
  --out public/tiles/region.pmtiles
```

**Important:** the server must send `Accept-Ranges: bytes` and allow the `Range` header
(see `deploy/nginx.conf`), otherwise PMTiles cannot read the archive.

## 8. Terrain tiles (offline hillshade / elevation)

Terrain-aware routing needs elevation. Build a Terrain-RGB PMTiles archive from a DEM
(SRTM, Copernicus DEM, or a national LiDAR product):

```bash
# 1. Reproject the DEM to web mercator
gdalwarp -t_srs EPSG:3857 -r bilinear dem.tif dem-3857.tif

# 2. Encode elevation into RGB (Mapbox Terrain-RGB encoding)
rio rgbify -b -10000 -i 0.1 dem-3857.tif terrain-rgb.tif

# 3. Cut into tiles, then pack
gdal2tiles.py --profile=mercator --zoom=6-12 -w none terrain-rgb.tif terrain-tiles/
pmtiles convert terrain.mbtiles public/tiles/terrain.pmtiles
```

`scripts/make-terrain.sh` automates this. MapLibre consumes it as a `raster-dem` source;
the app then enables `setTerrain()` plus a `hillshade` layer when the Terrain basemap is
selected, and samples the same DEM to draw the route elevation profile.

## 9. Supabase schema (PostGIS)

`supabase/migrations/0001_init_postgis.sql`

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;
```

`supabase/migrations/0002_facilities.sql`

```sql
create type facility_category as enum
  ('hospital','school','shelter','water','power','comms');

create type facility_status as enum
  ('open','limited','closed','unknown');

create table if not exists public.facilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      facility_category not null,
  geom          geography(Point, 4326) not null,
  address       text,
  capacity      integer check (capacity is null or capacity >= 0),
  occupancy     integer check (occupancy is null or occupancy >= 0),
  status        facility_status not null default 'unknown',
  resources     jsonb not null default '{}'::jsonb,  -- {power,water,oxygen,fuel,beds}
  contact_phone text,
  notes         text,
  verified_at   timestamptz,
  last_updated  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index facilities_geom_idx     on public.facilities using gist (geom);
create index facilities_category_idx on public.facilities (category);
create index facilities_status_idx   on public.facilities (status);
create index facilities_name_trgm    on public.facilities using gin (name gin_trgm_ops);

create table if not exists public.facility_updates (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities(id) on delete cascade,
  status       facility_status not null,
  capacity     integer,
  occupancy    integer,
  message      text,
  reporter     text,
  reported_at  timestamptz not null default now(),
  client_id    text unique          -- idempotency key for offline outbox replay
);
create index facility_updates_facility_idx on public.facility_updates (facility_id, reported_at desc);

create table if not exists public.hazards (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,        -- flood | landslide | blocked_road | fire | conflict
  severity    smallint not null default 1 check (severity between 1 and 5),
  geom        geography(Geometry, 4326) not null,
  description text,
  reported_at timestamptz not null default now(),
  expires_at  timestamptz
);
create index hazards_geom_idx on public.hazards using gist (geom);

-- keep facilities.last_updated fresh, and mirror the newest report onto the facility
create or replace function public.apply_facility_update() returns trigger
language plpgsql as $$
begin
  update public.facilities
     set status       = new.status,
         capacity     = coalesce(new.capacity, capacity),
         occupancy    = coalesce(new.occupancy, occupancy),
         verified_at  = new.reported_at,
         last_updated = now()
   where id = new.facility_id;
  return new;
end $$;

create trigger facility_updates_apply
after insert on public.facility_updates
for each row execute function public.apply_facility_update();
```

`supabase/migrations/0003_rpc_nearby.sql`

```sql
-- Nearby facilities with distance, filtered by category/status/capacity.
create or replace function public.facilities_nearby(
  in_lng        double precision,
  in_lat        double precision,
  in_radius_m   double precision default 25000,
  in_categories facility_category[] default null,
  in_statuses   facility_status[] default null,
  in_min_capacity integer default null,
  in_limit      integer default 200
)
returns table (
  id uuid, name text, category facility_category, status facility_status,
  lng double precision, lat double precision, distance_m double precision,
  capacity integer, occupancy integer, resources jsonb,
  address text, contact_phone text, notes text,
  verified_at timestamptz, last_updated timestamptz
)
language sql stable as $$
  select f.id, f.name, f.category, f.status,
         st_x(f.geom::geometry), st_y(f.geom::geometry),
         st_distance(f.geom, st_point(in_lng, in_lat)::geography),
         f.capacity, f.occupancy, f.resources,
         f.address, f.contact_phone, f.notes, f.verified_at, f.last_updated
    from public.facilities f
   where st_dwithin(f.geom, st_point(in_lng, in_lat)::geography, in_radius_m)
     and (in_categories is null or f.category = any(in_categories))
     and (in_statuses   is null or f.status   = any(in_statuses))
     and (in_min_capacity is null or coalesce(f.capacity, 0) >= in_min_capacity)
   order by 7
   limit in_limit;
$$;

-- Everything inside a bbox: used to prime the offline cache for a downloaded region.
create or replace function public.facilities_in_bbox(
  min_lng double precision, min_lat double precision,
  max_lng double precision, max_lat double precision
)
returns setof public.facilities
language sql stable as $$
  select * from public.facilities
   where st_intersects(geom, st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography);
$$;
```

`supabase/migrations/0004_rls.sql`

```sql
alter table public.facilities       enable row level security;
alter table public.facility_updates enable row level security;
alter table public.hazards          enable row level security;

create policy "facilities readable"       on public.facilities       for select using (true);
create policy "hazards readable"          on public.hazards          for select using (true);
create policy "updates readable"          on public.facility_updates for select using (true);
-- Field reports are append-only from clients; edits require a service role.
create policy "updates insertable" on public.facility_updates for insert with check (true);
```

Apply them:

```bash
supabase login
supabase link --project-ref <ref>
supabase db push                       # runs supabase/migrations in order
psql "$SUPABASE_DB_URL" -f supabase/seed/facilities.seed.sql
```

Or paste each migration into the Supabase SQL editor in order.

## 10. Offline architecture

Four cooperating layers:

1. **App shell** — `vite-plugin-pwa` (Workbox `generateSW`) precaches the JS/CSS/HTML/icon
   assets. Navigation falls back to `index.html` so deep links work offline.
2. **Tiles** — `.pmtiles` archives are fetched with range requests and stored in a
   dedicated `resilience-tiles` cache (`CacheFirst`, 1-year expiry). A region "download"
   walks the archive's byte ranges for the selected bbox/zoom span and warms that cache.
3. **Facility data** — `src/lib/facilities.ts` is a repository with a strict order:
   Supabase (when online) → IndexedDB snapshot → bundled seed dataset. Every successful
   network read writes back to IndexedDB with a fetched-at timestamp, which the offline
   banner surfaces as data freshness.
4. **Writes** — status reports go into an IndexedDB `outbox` store with a client-generated
   idempotency key and are replayed on `online` events (and by the SW's background-sync
   registration where supported). `facility_updates.client_id` is unique, so replays are
   safe.

Storage budget: check `navigator.storage.estimate()` before a download and refuse if the
estimate exceeds the remaining quota; request `navigator.storage.persist()` so the browser
does not evict tiles under pressure.

## 11. Routing & elevation profile

Routing must work offline, so it never depends on a hosted routing API:

- A local graph is built from the road layer of the PMTiles archive (or the bundled seed
  network in demo mode).
- Cost function: `length / speed × terrainPenalty(slope) × hazardPenalty(distanceToHazard)`.
  Slopes above a configurable grade are penalised for wheeled modes; hazard polygons
  multiply cost and, above severity 4, are hard-excluded.
- `src/lib/routing.ts` runs A* with a haversine heuristic, then samples elevation along
  the polyline from the terrain DEM to produce the profile series.
- The profile chart, ETA row and step list all read from the same `RoutePlan` object, and
  `CautionBanner` renders when any leg crosses an unverified or stale segment.

Swap in OSRM/Valhalla later by implementing the same `RouteProvider` interface; the UI
does not change.

## 12. Build & quality gates

```bash
npm run typecheck   # must be clean
npm run lint        # must be clean
npm run build       # emits dist/ + sw.js
npm run preview     # verify offline behaviour: load, then DevTools → Network → Offline
```

Manual offline acceptance checklist:

- [ ] Load the app online once, then go offline and hard-reload — the shell still boots.
- [ ] Explore screen renders the map from the cached PMTiles archive.
- [ ] Category chips, filter sheet, facility sheet and saved list all work offline.
- [ ] A status report submitted offline appears in Alerts as "queued", then syncs.
- [ ] Offline screen shows the downloaded region with an accurate size in MB.

## 13. VPS deployment (Docker + nginx)

### 13.1 Multi-stage image

`Dockerfile` builds with Node then serves the static bundle from nginx:

```bash
docker build -t resilience-maps:latest .
docker run --rm -p 8080:80 \
  -v /srv/resilience-maps/tiles:/usr/share/nginx/html/tiles:ro \
  resilience-maps:latest
```

Tiles are mounted rather than baked into the image — archives are large and change on a
different cadence than the app.

### 13.2 docker-compose on the VPS

```bash
# on the server
sudo mkdir -p /srv/resilience-maps/tiles
sudo rsync -av ./public/tiles/ /srv/resilience-maps/tiles/

git clone <repo-url> /srv/resilience-maps/app
cd /srv/resilience-maps/app
cp .env.example .env.production   # build-time VITE_* values
docker compose up -d --build
docker compose logs -f
```

`docker-compose.yml` exposes `127.0.0.1:8080` only; a host nginx terminates TLS.

### 13.3 Host nginx + TLS

```nginx
server {
  listen 443 ssl http2;
  server_name maps.example.org;

  ssl_certificate     /etc/letsencrypt/live/maps.example.org/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/maps.example.org/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
server {
  listen 80;
  server_name maps.example.org;
  return 301 https://$host$request_uri;
}
```

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d maps.example.org
```

HTTPS is mandatory: service workers, geolocation and persistent storage are all
secure-context APIs.

### 13.4 Container nginx specifics

`deploy/nginx.conf` must:

- serve `index.html` for unknown paths (`try_files $uri /index.html;`),
- keep `Accept-Ranges: bytes` on `/tiles/*.pmtiles` and never gzip them,
- send `Cache-Control: no-cache` for `sw.js` and `index.html` so updates land,
- send `Cache-Control: public, max-age=31536000, immutable` for hashed assets,
- add `Cross-Origin-Opener-Policy`/`X-Content-Type-Options` hardening headers,
- gzip JSON/JS/CSS but leave `.pmtiles` and images alone.

### 13.5 Updating a deployment

```bash
cd /srv/resilience-maps/app
git pull
docker compose up -d --build
# refresh tiles without touching the app
rsync -av ./data/region.pmtiles /srv/resilience-maps/tiles/region.pmtiles
```

Clients pick up the new build on the next visit; `workbox-window` prompts for reload.

## 14. Operations runbook

| Task | Command / action |
| --- | --- |
| Rebuild tiles for a new AOI | `./scripts/make-pmtiles.sh --bbox … --out …` then rsync |
| Re-seed facilities | `npm run seed` (uses `SUPABASE_SERVICE_ROLE_KEY`) |
| Inspect an archive | `pmtiles show public/tiles/region.pmtiles` |
| Check storage on device | Offline screen → Storage meter |
| Force a client cache purge | Bump `CACHE_VERSION` in `src/app/serviceWorker.ts` |
| Verify range requests | `curl -I -H 'Range: bytes=0-99' https://host/tiles/region.pmtiles` |

## 15. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Map is blank, console shows `pmtiles` 4xx/5xx | Range requests blocked; check `Accept-Ranges` and that gzip is off for `.pmtiles` |
| Map blank with no errors | PMTiles archive bounds do not include the default centre — check `pmtiles show` and `VITE_DEFAULT_CENTER` |
| Terrain toggle does nothing | `VITE_TERRAIN_PMTILES_URL` unset or DEM is not Terrain-RGB encoded |
| `st_dwithin` errors | `geom` is `geometry` not `geography`, or PostGIS extension missing |
| Offline reload shows the browser error page | Served over HTTP, or the SW was not registered — confirm HTTPS and `sw.js` returns 200 |
| Facilities empty online | RLS select policy missing, or the anon key is wrong |
| Download estimate wildly off | Zoom range too wide; estimates assume ~10–40 KB per vector tile |
