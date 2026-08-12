# Resilience Maps — Installation & Build Guide

Resilience Maps is an offline-first, Google-Maps-styled web app for locating
critical infrastructure (hospitals, schools, shelters, water sources, comms
towers, and power sites) when connectivity is degraded or unavailable during
disasters. It ships terrain-aware offline vector tiles (PMTiles), a
PostGIS-backed facility directory, and a Workbox/IndexedDB caching layer so
the map, facility data, and last-known routes keep working with no network.

This document is the single source of truth for **what to build**. It is
written before any code exists, and the scaffold that follows implements it
screen-by-screen, starting with the Explore map, category chips, and layers
drawer.

---

## 1. Screen & Component Inventory

Each reference pattern from the Google Maps iOS audit is mapped to a
Resilience Maps screen/component below, with the disaster-response reskin of
every label, icon, and action.

### 1.1 Explore (Home) Screen — `src/screens/ExploreScreen.tsx`

Full-bleed map is the app shell; everything else floats above it.

| Element | Google Maps pattern | Resilience Maps reskin | Component |
|---|---|---|---|
| Background | Full-bleed map | Full-bleed MapLibre GL map w/ PMTiles + terrain hillshade | `map/MapCanvas.tsx` |
| Search bar | Floating rounded bar, top, mic icon | Floating rounded search bar, top, mic icon (voice status query), searches facilities + places | `search/SearchBar.tsx` |
| Category chips | Restaurants / Hotels / Coffee | Hospitals / Schools / Shelters / Water / Power / Comms — horizontal scroll, multi-select | `filters/CategoryChips.tsx` |
| My-location FAB | Small circular, bottom-right | Small circular "center on me" button, offline GPS fallback | `map/MyLocationButton.tsx` |
| Primary FAB | Larger circular, directions | Larger circular "Get Directions / Nearest Safe Route" FAB | `map/PrimaryFab.tsx` |
| Bottom tabs | Explore / Go / Saved / Contribute / Updates | **Explore / Routes / Saved / Offline / Alerts** | `nav/BottomTabBar.tsx` |
| Layers button | Circular stacked-squares, top-right | Same icon/position, opens Layers Drawer | `layers/LayersButton.tsx` |

### 1.2 Layers Drawer — `src/screens/LayersDrawer.tsx`

Slide-in panel (right-anchored on desktop, bottom sheet on mobile) opened
from the layers button.

- **Base map** segmented control: Streets / Terrain / Satellite
- **Terrain overlay** toggle (hillshade + contour lines from PMTiles)
- **Facility categories** toggle list (mirrors chips, with counts)
- **Offline regions overlay** toggle — draws downloaded bounding boxes on
  the map with a dashed outline + "Downloaded" badge
- **Hazard overlay** toggle (flood/fire/blocked-road hints, when data exists)

Component: `layers/LayersDrawer.tsx`, `layers/LayerToggleRow.tsx`,
`layers/BaseMapSegmentedControl.tsx`.

### 1.3 Filter Panel — `src/screens/FilterSheet.tsx`

Slide-up sheet (Radix/Vaul-style drag handle), triggered from the search bar
"Filters" affordance.

- Pill-style toggle group for status: Operational / Limited / Offline / Unknown
- Pill-style toggle group for category (syncs with chips)
- Sort-by segmented control: Distance / Capacity / Last Updated
- Range slider: **Capacity** (repurposed from Maps' price range) — filters
  facilities by reported capacity (beds, occupancy, liters/day, etc.)
- Range slider: **Distance** (km) from current/search location
- "Apply" primary button + "Reset" text button

Components: `filters/FilterSheet.tsx`, `filters/PillToggleGroup.tsx`,
`filters/SortSegmentedControl.tsx`, `filters/RangeSlider.tsx`.

### 1.4 POI Detail Card — `src/screens/PoiDetailSheet.tsx`

Bottom sheet (peek / half / full drag states) shown when a facility marker
or search result is selected.

- Header: name, category icon, **status pill** (Operational/Limited/
  Offline/Unknown, color-coded) instead of star rating
- Action pill row: **Directions / Report Status / Save / Call**
- Tabs: **Overview / Capacity / Resources / Updates**
  - Overview: address, hours, description, last verified timestamp
  - Capacity: current occupancy vs. max, trend, editable by field responders
  - Resources: available resources (beds, water, fuel, generators) as tags
  - Updates: crowd-sourced status reports, timestamped, offline-queued
- "Report Status" opens `report/ReportStatusModal.tsx` — a lightweight form
  that queues writes in IndexedDB when offline and syncs via Supabase when
  back online.

Components: `poi/PoiDetailSheet.tsx`, `poi/StatusPill.tsx`,
`poi/ActionPillRow.tsx`, `poi/PoiTabs.tsx`, `report/ReportStatusModal.tsx`.

### 1.5 Route / Directions Screen — `src/screens/RouteScreen.tsx`

- Top: map preview with drawn route line(s), alternate routes dimmed
- Mode tabs: Walk / Drive / 4x4 / On-foot terrain
- ETA + distance row, updates live as terrain profile is considered
- **Elevation/terrain profile chart** — critical for resilience routing
  around hazards, floodplains, and washouts (`route/ElevationProfile.tsx`,
  SVG/Canvas area chart, hover to sync a marker on the route)
- Caution banner: **"Route may be blocked or unverified — conditions may
  vary"** (repurposed from Maps' price/conditions banner), with severity
  levels (info/warning/danger) and a "reported by" attribution
- Numbered turn-by-turn steps list, each with icon + distance
- Bottom bar: **Preview** / **Start Navigation** buttons

Components: `route/RouteScreen.tsx`, `route/ModeTabs.tsx`,
`route/EtaDistanceRow.tsx`, `route/ElevationProfile.tsx`,
`route/CautionBanner.tsx`, `route/TurnByTurnList.tsx`.

### 1.6 Offline Downloads Screen — `src/screens/OfflineScreen.tsx`

- Header CTA card: **"See what you can download"** → opens
  `offline/RegionSelector.tsx`
- `RegionSelector`: map with a draggable/resizable bounding-box, live
  estimated download size (MB) computed from PMTiles tile-count heuristics,
  a "Download region for offline use" primary button, zoom-level selector
  (min/max), and category selector (which facility layers to bundle)
- List of downloaded regions: name, bounding box thumbnail, size in MB,
  downloaded-at date, per-item status icon (queued / downloading / ready /
  stale / failed), delete + re-sync actions
- Storage usage bar (used / quota, via `navigator.storage.estimate()`)

Components: `offline/OfflineScreen.tsx`, `offline/RegionSelector.tsx`,
`offline/DownloadedRegionRow.tsx`, `offline/StorageUsageBar.tsx`.

### 1.7 Alerts Screen — `src/screens/AlertsScreen.tsx` (5th tab)

Not in the Mobbin reference set explicitly, but required by the bottom tab
bar reskin (Updates → Alerts). Lists resilience-relevant alerts (facility
status changes, new hazard reports, offline sync results) as a simple
timeline feed, each item deep-linking back to the relevant POI or route.

### 1.8 Shared / Cross-cutting Components

- `nav/BottomTabBar.tsx` — 5 tabs, active state, badge support (e.g.
  unread alerts count)
- `map/MapCanvas.tsx` — MapLibre GL instance, PMTiles protocol
  registration, terrain source, marker clustering (Supercluster)
- `map/FacilityMarker.tsx` — category-colored pin, clustering-aware
- `ui/` — design-system primitives: `Card`, `Chip`, `Button`, `IconButton`,
  `BottomSheet`, `SegmentedControl`, `Slider`, `Badge`, `Skeleton`
- `offline/OfflineBanner.tsx` — persistent top banner when
  `navigator.onLine === false`, shows "Offline — showing cached data"
- `network/NetworkStatusProvider.tsx` — React context wrapping
  `online`/`offline` events + Workbox sync status

---

## 2. File & Folder Structure

```
resilience-maps/
├── INSTALLATION_GUIDE.md
├── README.md
├── docker/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── docker-compose.yml
├── supabase/
│   ├── migrations/
│   │   └── 0001_init_facilities.sql
│   └── seed.sql
├── scripts/
│   ├── pmtiles/
│   │   ├── 01_download_osm_extract.sh
│   │   ├── 02_build_terrain_dem.sh
│   │   ├── 03_generate_vector_pmtiles.sh
│   │   ├── 04_generate_terrain_pmtiles.sh
│   │   └── tileset.json
│   └── seed-facilities.ts
├── public/
│   ├── tiles/                 # generated *.pmtiles served statically (or via CDN/object storage)
│   │   ├── streets.pmtiles
│   │   └── terrain.pmtiles
│   ├── icons/
│   ├── manifest.webmanifest
│   └── favicon.svg
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── vite-env.d.ts
    ├── styles/
    │   └── index.css
    ├── app/
    │   ├── router.tsx
    │   └── AppShell.tsx
    ├── screens/
    │   ├── ExploreScreen.tsx      # composes map + search + chips + drawers/sheets below
    │   ├── RouteScreen.tsx        # re-exports route/RouteScreen.tsx (routed screen)
    │   ├── OfflineScreen.tsx      # re-exports offline/OfflineScreen.tsx (routed screen)
    │   ├── SavedScreen.tsx
    │   └── AlertsScreen.tsx
    ├── map/
    │   ├── MapCanvas.tsx
    │   ├── MapProvider.tsx
    │   ├── FacilityMarker.tsx
    │   ├── MyLocationButton.tsx
    │   ├── PrimaryFab.tsx
    │   ├── useMapInstance.ts
    │   ├── pmtilesProtocol.ts
    │   └── mapStyles.ts
    ├── search/
    │   ├── SearchBar.tsx
    │   └── useFacilitySearch.ts
    ├── filters/
    │   ├── CategoryChips.tsx
    │   ├── FilterSheet.tsx
    │   ├── PillToggleGroup.tsx
    │   ├── SortSegmentedControl.tsx
    │   └── RangeSlider.tsx
    ├── layers/
    │   ├── LayersButton.tsx
    │   ├── LayersDrawer.tsx
    │   ├── LayerToggleRow.tsx
    │   └── BaseMapSegmentedControl.tsx
    ├── poi/
    │   ├── PoiDetailSheet.tsx
    │   ├── StatusPill.tsx
    │   ├── ActionPillRow.tsx
    │   └── PoiTabs.tsx
    ├── report/
    │   └── ReportStatusModal.tsx
    ├── route/
    │   ├── RouteScreen.tsx
    │   ├── ModeTabs.tsx
    │   ├── EtaDistanceRow.tsx
    │   ├── ElevationProfile.tsx
    │   ├── CautionBanner.tsx
    │   └── TurnByTurnList.tsx
    ├── offline/
    │   ├── OfflineScreen.tsx
    │   ├── RegionSelector.tsx
    │   ├── DownloadedRegionRow.tsx
    │   ├── StorageUsageBar.tsx
    │   └── downloadManager.ts
    ├── nav/
    │   └── BottomTabBar.tsx
    ├── network/
    │   └── NetworkStatusProvider.tsx
    ├── data/
    │   ├── supabaseClient.ts
    │   ├── facilities.ts
    │   ├── mockFacilities.ts
    │   └── types.ts
    ├── store/
    │   ├── useAppStore.ts
    │   ├── useFilterStore.ts
    │   └── useOfflineStore.ts
    ├── sw/
    │   ├── service-worker.ts
    │   └── registerSW.ts
    └── ui/
        ├── Card.tsx
        ├── Chip.tsx
        ├── Button.tsx
        ├── IconButton.tsx
        ├── BottomSheet.tsx
        ├── SegmentedControl.tsx
        ├── Slider.tsx
        ├── Badge.tsx
        └── Skeleton.tsx
```

---

## 3. Required npm Packages

Runtime:

```bash
npm install react react-dom react-router-dom \
  maplibre-gl pmtiles \
  @supabase/supabase-js \
  zustand \
  clsx \
  lucide-react \
  workbox-window \
  idb \
  supercluster
```

Dev tooling:

```bash
npm install -D vite @vitejs/plugin-react typescript \
  tailwindcss postcss autoprefixer \
  workbox-cli \
  eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh \
  vite-plugin-pwa \
  @types/react @types/react-dom @types/geojson
```

Notes:

- **`maplibre-gl` + `pmtiles`**: the PMTiles JS SDK registers a custom
  `pmtiles://` protocol with MapLibre so `.pmtiles` archives can be read via
  HTTP range requests — no tile server required, works great from a static
  file host, object storage, or the nginx container we ship in §6.
- **`vite-plugin-pwa`** wraps Workbox to generate the service worker and
  precache manifest at build time; `workbox-window` is used client-side to
  register/update the SW and surface update prompts.
- **`idb`** is a tiny Promise wrapper around IndexedDB used for the offline
  facility cache, queued status reports, and downloaded-region metadata.
- **`supercluster`** provides marker clustering for dense facility layers at
  low zoom levels.
- **`zustand`** is the lightweight global store for filters, selection
  state, and offline/online status — avoids pulling in Redux for this scope.

---

## 4. PMTiles Generation Pipeline (from OpenStreetMap extracts)

Goal: produce two `.pmtiles` archives — `streets.pmtiles` (vector, roads/
buildings/POIs) and `terrain.pmtiles` (raster-dem hillshade + contours) — for
a chosen region, entirely offline-servable as static files.

### 4.1 Tooling

- [`osmium-tool`](https://osmcode.org/osmium-tool/) — extract/clip OSM data
- [`Planetiler`](https://github.com/onthegomap/planetiler) — fast OSM →
  MBTiles/PMTiles vector tile builder (OpenMapTiles schema)
- [`go-pmtiles`](https://github.com/protomaps/go-pmtiles) — convert MBTiles
  → PMTiles, and inspect/verify archives
- [`gdal`](https://gdal.org/) + [`rio-rgbify`](https://github.com/mapbox/rio-rgbify)
  — build Terrain-RGB raster-dem tiles from SRTM/Copernicus DEM
- Source data: [Geofabrik](https://download.geofabrik.de/) regional `.osm.pbf`
  extracts; [Copernicus GLO-30 DEM](https://spacedata.copernicus.eu/) or
  [SRTM 30m](https://dwtkns.com/srtm30m/) for elevation

### 4.2 Scripts (in `scripts/pmtiles/`)

**`01_download_osm_extract.sh`** — downloads a Geofabrik `.osm.pbf` extract
for the target region and verifies its checksum.

```bash
#!/usr/bin/env bash
set -euo pipefail
REGION_URL="${1:?Usage: 01_download_osm_extract.sh <geofabrik-pbf-url>}"
OUT_DIR="$(dirname "$0")/../../data/osm"
mkdir -p "$OUT_DIR"
curl -L "$REGION_URL" -o "$OUT_DIR/region.osm.pbf"
curl -L "$REGION_URL.md5" -o "$OUT_DIR/region.osm.pbf.md5" || true
(cd "$OUT_DIR" && md5sum -c region.osm.pbf.md5) || echo "checksum skipped"
```

**`02_build_terrain_dem.sh`** — clips a DEM to the region bbox and produces
Terrain-RGB tiles with `rio-rgbify`, then a raster-dem MBTiles.

```bash
#!/usr/bin/env bash
set -euo pipefail
BBOX="${1:?Usage: 02_build_terrain_dem.sh <minlon,minlat,maxlon,maxlat> <dem.tif>}"
DEM_SRC="${2:?missing DEM source geotiff}"
OUT_DIR="$(dirname "$0")/../../data/terrain"
mkdir -p "$OUT_DIR"
gdalwarp -te ${BBOX//,/ } -of GTiff "$DEM_SRC" "$OUT_DIR/clipped.tif"
rio rgbify -b -10000 -i 0.1 "$OUT_DIR/clipped.tif" "$OUT_DIR/terrain-rgb.tif"
gdal_translate -of MBTILES "$OUT_DIR/terrain-rgb.tif" "$OUT_DIR/terrain.mbtiles"
```

**`03_generate_vector_pmtiles.sh`** — runs Planetiler against the extract
using the OpenMapTiles profile, then converts to PMTiles.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(dirname "$0")/../.."
java -Xmx4g -jar planetiler.jar --force \
  --osm-path="$ROOT/data/osm/region.osm.pbf" \
  --output="$ROOT/data/osm/streets.mbtiles" \
  --minzoom=0 --maxzoom=14
go-pmtiles convert "$ROOT/data/osm/streets.mbtiles" "$ROOT/public/tiles/streets.pmtiles"
go-pmtiles verify "$ROOT/public/tiles/streets.pmtiles"
```

**`04_generate_terrain_pmtiles.sh`** — converts the raster-dem MBTiles into
PMTiles for hillshade/contour rendering.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(dirname "$0")/../.."
go-pmtiles convert "$ROOT/data/terrain/terrain.mbtiles" "$ROOT/public/tiles/terrain.pmtiles"
go-pmtiles verify "$ROOT/public/tiles/terrain.pmtiles"
```

Run order: `01 → 02 → 03 → 04`. Output lands in `public/tiles/*.pmtiles`,
which the app loads via `pmtiles://` (local dev/static hosting) or a signed
object-storage URL in production (see §6 for serving them with byte-range
support behind nginx).

### 4.3 Runtime wiring

`src/map/pmtilesProtocol.ts` registers the protocol once at app startup:

```ts
import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";

const protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);
```

The MapLibre style (`src/map/mapStyles.ts`) then references sources as
`pmtiles:///tiles/streets.pmtiles` (vector) and
`pmtiles:///tiles/terrain.pmtiles` (raster-dem, used for `hillshade` +
`contour` layers and the elevation profile queries on the Route screen).

---

## 5. Supabase Schema (PostGIS)

File: `supabase/migrations/0001_init_facilities.sql`. Enumerated columns per
the deliverable spec: **category, geom, capacity, status, last_updated**,
plus supporting fields needed by the POI detail card, filters, and offline
sync queue.

```sql
create extension if not exists postgis;

create type facility_category as enum (
  'hospital', 'school', 'shelter', 'water', 'power', 'comms'
);

create type facility_status as enum (
  'operational', 'limited', 'offline', 'unknown'
);

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category facility_category not null,
  geom geometry(Point, 4326) not null,
  address text,
  capacity integer,
  capacity_unit text default 'people',
  occupancy integer,
  status facility_status not null default 'unknown',
  resources jsonb not null default '[]'::jsonb,
  contact_phone text,
  description text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index facilities_geom_idx on facilities using gist (geom);
create index facilities_category_idx on facilities (category);
create index facilities_status_idx on facilities (status);

create table if not exists status_reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities (id) on delete cascade,
  reported_status facility_status not null,
  note text,
  reporter_device_id text,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index status_reports_facility_idx on status_reports (facility_id);

create table if not exists offline_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bbox geometry(Polygon, 4326) not null,
  min_zoom integer not null default 0,
  max_zoom integer not null default 14,
  categories facility_category[] not null default '{}',
  size_estimate_mb numeric,
  created_at timestamptz not null default now()
);

-- Geospatial RPC: facilities within radius (meters) of a point, optional
-- category filter, used by the Explore/Search/Filter screens.
create or replace function facilities_within_radius(
  center_lng double precision,
  center_lat double precision,
  radius_m double precision,
  categories facility_category[] default null
)
returns setof facilities
language sql stable
as $$
  select f.*
  from facilities f
  where ST_DWithin(
    f.geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_m
  )
  and (categories is null or f.category = any(categories))
  order by ST_Distance(
    f.geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
  );
$$;

alter table facilities enable row level security;
alter table status_reports enable row level security;
alter table offline_regions enable row level security;

create policy "Public read access to facilities"
  on facilities for select using (true);
create policy "Public read access to status reports"
  on status_reports for select using (true);
create policy "Public insert of status reports"
  on status_reports for insert with check (true);
create policy "Public read access to offline regions"
  on offline_regions for select using (true);
```

Seed data lives in `supabase/seed.sql` and `scripts/seed-facilities.ts`
(idempotent upsert script usable against a local or hosted project).

The client (`src/data/supabaseClient.ts`) reads
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from the environment. When
those are unset or a request fails (offline), `src/data/facilities.ts`
transparently falls back to the IndexedDB-cached facility set / bundled
`mockFacilities.ts` fixture, so the Explore screen always has data to render
in development or fully offline.

---

## 6. Deployment

### 6.1 Local development

```bash
git clone <repo-url> resilience-maps
cd resilience-maps
npm install
cp .env.example .env.local        # fill in Supabase URL/anon key (optional)
# Generate or copy in tiles, or use the bundled demo tiles for local dev:
#   see §4 for the full PMTiles generation pipeline
npm run dev                       # Vite dev server, http://localhost:5173
```

Run the Supabase migration against a local or hosted project:

```bash
supabase link --project-ref <project-ref>
supabase db push        # applies supabase/migrations/0001_init_facilities.sql
npx tsx scripts/seed-facilities.ts
```

### 6.2 Production build

```bash
npm run build      # tsc -b && vite build -> dist/
npm run preview    # sanity-check the production build locally
```

The build emits a Workbox-generated service worker (via `vite-plugin-pwa`)
that precaches the app shell and runtime-caches `/tiles/*.pmtiles` requests
with a cache-first strategy plus range-request passthrough, and facility API
responses with a stale-while-revalidate strategy.

### 6.3 Docker + nginx (VPS deployment)

`docker/Dockerfile` — multi-stage build:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

`docker/nginx.conf` — serves the SPA, enables byte-range requests for
`.pmtiles` (required by the PMTiles HTTP client), sets long-lived caching
for tiles/assets, and falls back to `index.html` for client-side routing:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;

  gzip on;
  gzip_types text/plain application/javascript application/json text/css;

  location /tiles/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    # nginx supports byte-range (Accept-Ranges) by default for static files,
    # which is what the PMTiles client relies on.
  }

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location /service-worker.js {
    add_header Cache-Control "no-cache";
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`docker/docker-compose.yml` — app container + optional local Supabase stack:

```yaml
services:
  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "8080:80"
    volumes:
      - ../public/tiles:/usr/share/nginx/html/tiles:ro
    restart: unless-stopped
```

VPS steps:

```bash
scp -r resilience-maps user@your-vps:/opt/resilience-maps
ssh user@your-vps
cd /opt/resilience-maps
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
# app now serves on http://<vps-ip>:8080
# put a TLS-terminating reverse proxy (Caddy/Traefik) in front for HTTPS
```

For large `.pmtiles` archives, prefer serving them from object storage
(S3/R2/MinIO) with range-request support and pointing
`VITE_TILES_BASE_URL` at that origin, rather than baking multi-GB files into
the Docker image.

---

## 7. Environment Variables

`.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TILES_BASE_URL=/tiles
VITE_MAP_DEFAULT_CENTER_LNG=-122.4194
VITE_MAP_DEFAULT_CENTER_LAT=37.7749
VITE_MAP_DEFAULT_ZOOM=11
```

---

## 8. Build Order (what this scaffold implements first)

1. Project scaffold (Vite + React + TS + Tailwind, design tokens for the
   `#1A73E8` accent, `rounded-2xl` cards, soft shadows).
2. `MapCanvas` with PMTiles protocol + demo style (works with or without
   generated tiles, via MapLibre's demo raster fallback style in dev).
3. `ExploreScreen` shell: floating `SearchBar`, `CategoryChips`,
   `MyLocationButton`, `PrimaryFab`, `BottomTabBar`.
4. `LayersButton` + `LayersDrawer` (base map switch, terrain toggle,
   category toggles, offline overlay toggle).
5. Supabase client + facility data hook with mock-data fallback, wired into
   the map as clustered markers filtered by the active chips.
6. Remaining screens (`FilterSheet`, `PoiDetailSheet`, `RouteScreen`,
   `OfflineScreen`, `SavedScreen`, `AlertsScreen`) as fully-styled,
   navigable screens with representative data, ready for deeper feature
   work.
7. Service worker registration + offline banner.

Everything after step 4 is included in this scaffold as functional
placeholders/UI-complete screens so the whole reference-pattern set is
navigable end-to-end, even before live Supabase data and generated regional
PMTiles are plugged in.
