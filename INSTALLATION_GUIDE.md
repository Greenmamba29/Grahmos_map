# Resilience Maps Installation Guide

Resilience Maps is an offline-first, Google-Maps-style web application for finding critical infrastructure during connectivity outages. It uses React, TypeScript, MapLibre GL JS, PMTiles single-file vector tiles, Supabase/PostGIS, Workbox, IndexedDB, and Tailwind CSS.

## 1. Product scope and screen inventory

### 1. Explore / home screen

Reference pattern: Google Maps iOS Explore home.

Build:

- Full-bleed interactive MapLibre map.
- Floating rounded search bar at the top with a microphone icon.
- Horizontal category chips under search:
  - Hospitals
  - Schools
  - Shelters
  - Water
  - Power
  - Comms
- Floating top-right layers button.
- Floating circular "my location" button above a larger blue routing FAB.
- Bottom tab bar:
  - Explore
  - Routes
  - Saved
  - Offline
  - Alerts
- Offline status badge and downloaded-region overlay indicator.

Primary components:

- `ExploreMap`
- `SearchBar`
- `CategoryChips`
- `LayersDrawer`
- `FacilityMarker`
- `FloatingMapActions`
- `BottomNav`
- `OfflineStatusBadge`

### 2. Layers control

Reference pattern: Google Maps layers menu.

Build:

- Small circular stacked-square icon floating top-right.
- Slide-in/drawer panel with toggles for:
  - Terrain vector tiles
  - Satellite raster tiles
  - Hospitals
  - Schools
  - Shelters
  - Water sources
  - Power infrastructure
  - Communications towers
  - Offline downloaded regions overlay
- Basemap metadata:
  - PMTiles URL
  - Region name
  - Last tile update
  - Estimated offline tile size

Primary components:

- `LayersButton`
- `LayersDrawer`
- `LayerToggle`
- `OfflineRegionOverlayToggle`

### 3. Facility filter panel

Reference pattern: Google Maps filter bottom sheet.

Build:

- Slide-up sheet over the map.
- Pill-style status/category filters:
  - Open
  - Limited
  - Unknown
  - Critical
  - Verified recently
- Sort segmented control:
  - Nearest
  - Capacity
  - Last updated
  - Terrain safety
- Range slider:
  - Distance radius in kilometers, or
  - Facility capacity range
- Apply/reset controls.

Primary components:

- `FilterSheet`
- `FilterPills`
- `SortSegmentedControl`
- `RangeSlider`

### 4. POI detail card

Reference pattern: Google Maps POI detail bottom sheet.

Build:

- Bottom sheet anchored to selected marker.
- Facility title and category.
- Status row:
  - Operational / Limited / Closed / Unknown
  - Verification recency
  - Distance from user
- Action pill buttons:
  - Directions
  - Report Status
  - Save
  - Call
- Tabs:
  - Overview
  - Capacity
  - Resources
  - Updates
- Resource cards for beds, water, generators, radio, Wi-Fi, medical supplies.

Primary components:

- `PoiDetailCard`
- `StatusRow`
- `ActionPills`
- `ResourceTabs`
- `CapacityPanel`
- `UpdatesTimeline`

### 5. Route / directions screen

Reference pattern: Google Maps directions preview and turn-by-turn list.

Build:

- Top map preview with route line.
- Travel mode tabs:
  - Walk
  - Bike
  - Drive
  - Evacuation
- ETA + distance row.
- Elevation and terrain profile chart.
- Caution banner:
  - "Route may be blocked or unverified. Conditions may vary."
- Numbered turn-by-turn steps.
- Hazard avoidance toggles:
  - Avoid flooded roads
  - Avoid steep terrain
  - Avoid bridges
  - Prefer verified roads
- Bottom actions:
  - Preview
  - Show map
  - Save offline

Primary components:

- `RoutePreviewMap`
- `RouteModeTabs`
- `RouteSummary`
- `TerrainProfileChart`
- `CautionBanner`
- `TurnByTurnList`
- `HazardAvoidanceControls`

### 6. Offline downloads screen

Reference pattern: Google Maps offline downloads.

Build:

- Dedicated Offline tab.
- List of downloaded regions with:
  - Region name
  - Size in MB
  - Last updated
  - Expiration/staleness warning
  - Status icon
- Prominent CTA:
  - "Download region for offline use"
  - "See what you can download"
- Bounding-box selector over map.
- Live PMTiles size estimate.
- Download progress and retry controls.
- IndexedDB metadata for downloaded tile packs and facility snapshots.

Primary components:

- `OfflineDownloadsScreen`
- `DownloadedRegionCard`
- `DownloadRegionCta`
- `BoundingBoxSelector`
- `TileSizeEstimator`
- `DownloadProgress`

## 2. Recommended file and folder structure

```text
.
|-- INSTALLATION_GUIDE.md
|-- Dockerfile
|-- docker-compose.yml
|-- nginx.conf
|-- package.json
|-- public
|   |-- icons
|   |   `-- resilience.svg
|   `-- tiles
|       `-- README.md
|-- scripts
|   `-- generate-pmtiles.sh
|-- src
|   |-- App.tsx
|   |-- main.tsx
|   |-- styles.css
|   |-- components
|   |   |-- BottomNav.tsx
|   |   |-- CategoryChips.tsx
|   |   |-- ExploreMap.tsx
|   |   |-- FloatingMapActions.tsx
|   |   |-- LayersDrawer.tsx
|   |   |-- OfflineStatusBadge.tsx
|   |   `-- SearchBar.tsx
|   |-- data
|   |   `-- demoFacilities.ts
|   |-- lib
|   |   |-- mapStyle.ts
|   |   |-- offlineStore.ts
|   |   |-- registerServiceWorker.ts
|   |   `-- supabase.ts
|   `-- types.ts
`-- supabase
    |-- README.md
    `-- migrations
        `-- 0001_resilience_maps_schema.sql
```

## 3. Required npm packages

Runtime packages:

```bash
npm install react react-dom maplibre-gl pmtiles @supabase/supabase-js workbox-window idb lucide-react clsx
```

Development packages:

```bash
npm install -D vite typescript @vitejs/plugin-react tailwindcss @tailwindcss/vite vite-plugin-pwa eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh @types/react @types/react-dom
```

Why each package is used:

- `maplibre-gl`: open-source WebGL map renderer.
- `pmtiles`: custom MapLibre protocol handler for single-file vector tiles.
- `@supabase/supabase-js`: facility and sync API client.
- `idb`: small typed wrapper for IndexedDB offline metadata.
- `workbox-window` and `vite-plugin-pwa`: service worker registration and Workbox-powered app shell caching.
- `tailwindcss` and `@tailwindcss/vite`: utility-first styling with Google Maps-style white cards, rounded corners, soft shadows, and `#1A73E8` accent.
- `lucide-react`: lightweight UI icon set.

## 4. Environment variables

Create `.env.local` for local development:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_PMTILES_URL=/tiles/resilience-demo.pmtiles
VITE_DEFAULT_MAP_CENTER=-122.4194,37.7749
VITE_DEFAULT_MAP_ZOOM=11
```

Never expose a Supabase `service_role` key in the browser.

## 5. PMTiles generation pipeline from OpenStreetMap extracts

The app expects terrain-aware vector tiles as PMTiles. A production pipeline should combine OSM infrastructure features with terrain/hazard overlays.

### 5.1 Install tile tooling

On a build machine or VPS:

```bash
sudo apt-get update
sudo apt-get install -y curl jq osmium-tool gdal-bin

# Tippecanoe
git clone https://github.com/felt/tippecanoe.git
cd tippecanoe
make -j
sudo make install

# PMTiles CLI
curl -L https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_$(uname -s)_$(uname -m).tar.gz -o pmtiles.tar.gz
tar -xzf pmtiles.tar.gz
sudo mv pmtiles /usr/local/bin/pmtiles
```

### 5.2 Download an OSM extract

Use a Geofabrik region extract:

```bash
mkdir -p data/osm data/geojson public/tiles
curl -L "https://download.geofabrik.de/north-america/us/california-latest.osm.pbf" \
  -o data/osm/california-latest.osm.pbf
```

### 5.3 Extract critical infrastructure

Hospitals and medical facilities:

```bash
osmium tags-filter data/osm/california-latest.osm.pbf \
  n/amenity=hospital,w/amenity=hospital,r/amenity=hospital \
  n/amenity=clinic,w/amenity=clinic,r/amenity=clinic \
  -o data/osm/healthcare.osm.pbf --overwrite
```

Schools:

```bash
osmium tags-filter data/osm/california-latest.osm.pbf \
  n/amenity=school,w/amenity=school,r/amenity=school \
  -o data/osm/schools.osm.pbf --overwrite
```

Shelters, water, power, and communications:

```bash
osmium tags-filter data/osm/california-latest.osm.pbf \
  n/emergency=assembly_point,w/emergency=assembly_point,r/emergency=assembly_point \
  n/amenity=shelter,w/amenity=shelter,r/amenity=shelter \
  n/amenity=drinking_water,w/amenity=drinking_water,r/amenity=drinking_water \
  n/man_made=water_well,w/man_made=water_well,r/man_made=water_well \
  n/power=*,w/power=*,r/power=* \
  n/man_made=communications_tower,w/man_made=communications_tower,r/man_made=communications_tower \
  n/tower:type=communication,w/tower:type=communication,r/tower:type=communication \
  -o data/osm/resilience-infra.osm.pbf --overwrite
```

Convert to GeoJSON:

```bash
ogr2ogr -f GeoJSONSeq data/geojson/healthcare.geojsonseq data/osm/healthcare.osm.pbf
ogr2ogr -f GeoJSONSeq data/geojson/schools.geojsonseq data/osm/schools.osm.pbf
ogr2ogr -f GeoJSONSeq data/geojson/resilience-infra.geojsonseq data/osm/resilience-infra.osm.pbf
```

### 5.4 Add terrain-aware layers

Recommended terrain inputs:

- DEM-derived contour lines from USGS, Copernicus DEM, or SRTM.
- Slope raster converted to vector polygons by steepness class.
- Flood, fire, landslide, road-closure, and bridge-risk feeds from local agencies.

Example contour vectorization:

```bash
gdal_contour -a elev_m dem.tif data/geojson/contours.geojson -i 20
```

### 5.5 Build MBTiles and convert to PMTiles

```bash
tippecanoe \
  -o data/resilience.mbtiles \
  --force \
  --minimum-zoom=5 \
  --maximum-zoom=14 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  -L healthcare:data/geojson/healthcare.geojsonseq \
  -L schools:data/geojson/schools.geojsonseq \
  -L infrastructure:data/geojson/resilience-infra.geojsonseq \
  -L contours:data/geojson/contours.geojson

pmtiles convert data/resilience.mbtiles public/tiles/resilience-demo.pmtiles
pmtiles show public/tiles/resilience-demo.pmtiles
```

The scaffold includes `scripts/generate-pmtiles.sh` as a starting point.

## 6. Supabase schema

Enable PostGIS in the Supabase SQL editor or CLI:

```sql
create extension if not exists postgis with schema extensions;
```

Create facility category/status enums, the `facilities` table, spatial indexes, RLS, and RPC helpers:

```sql
create type public.facility_category as enum (
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
  'comms'
);

create type public.facility_status as enum (
  'operational',
  'limited',
  'closed',
  'unknown'
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.facility_category not null,
  geom extensions.geography(point, 4326) not null,
  address text,
  phone text,
  capacity integer,
  status public.facility_status not null default 'unknown',
  resources jsonb not null default '{}'::jsonb,
  source text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index facilities_geom_gix on public.facilities using gist (geom);
create index facilities_category_idx on public.facilities (category);
create index facilities_status_idx on public.facilities (status);
create index facilities_last_updated_idx on public.facilities (last_updated desc);

alter table public.facilities enable row level security;

create policy "Public can read facilities"
  on public.facilities
  for select
  to anon, authenticated
  using (true);
```

Bounding-box RPC for map viewport queries:

```sql
create or replace function public.facilities_in_view(
  min_lat float,
  min_long float,
  max_lat float,
  max_long float,
  categories public.facility_category[] default null
)
returns table (
  id uuid,
  name text,
  category public.facility_category,
  status public.facility_status,
  capacity integer,
  resources jsonb,
  phone text,
  last_updated timestamptz,
  lat float,
  long float
)
set search_path = ''
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.category,
    f.status,
    f.capacity,
    f.resources,
    f.phone,
    f.last_updated,
    extensions.st_y(f.geom::extensions.geometry) as lat,
    extensions.st_x(f.geom::extensions.geometry) as long
  from public.facilities f
  where f.geom operator(extensions.&&) extensions.st_setsrid(
    extensions.st_makebox2d(
      extensions.st_point(min_long, min_lat),
      extensions.st_point(max_long, max_lat)
    ),
    4326
  )::extensions.geography
  and (categories is null or f.category = any(categories));
$$;
```

Nearest-facility RPC:

```sql
create or replace function public.nearby_facilities(
  lat float,
  long float,
  radius_meters integer default 25000,
  categories public.facility_category[] default null
)
returns table (
  id uuid,
  name text,
  category public.facility_category,
  status public.facility_status,
  capacity integer,
  resources jsonb,
  phone text,
  last_updated timestamptz,
  facility_lat float,
  facility_long float,
  dist_meters float
)
set search_path = ''
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.category,
    f.status,
    f.capacity,
    f.resources,
    f.phone,
    f.last_updated,
    extensions.st_y(f.geom::extensions.geometry) as facility_lat,
    extensions.st_x(f.geom::extensions.geometry) as facility_long,
    extensions.st_distance(f.geom, extensions.st_point(long, lat)::extensions.geography) as dist_meters
  from public.facilities f
  where extensions.st_dwithin(f.geom, extensions.st_point(long, lat)::extensions.geography, radius_meters)
  and (categories is null or f.category = any(categories))
  order by f.geom operator(extensions.<->) extensions.st_point(long, lat)::extensions.geography;
$$;
```

The committed schema lives at `supabase/migrations/0001_resilience_maps_schema.sql`.

## 7. Local development

### 7.1 Install dependencies

```bash
npm install
```

### 7.2 Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with Supabase and PMTiles values.

### 7.3 Add local PMTiles

Place a PMTiles file at:

```text
public/tiles/resilience-demo.pmtiles
```

For quick UI work, the app still loads sample facilities even if the tile file is missing.

### 7.4 Run the app

```bash
npm run dev
```

Open `http://localhost:5173`.

### 7.5 Build and preview

```bash
npm run lint
npm run build
npm run preview
```

## 8. Offline architecture

### 8.1 Service worker

The Vite PWA plugin uses Workbox to precache:

- HTML app shell
- JS/CSS bundles
- manifest and icon assets

Runtime caching strategy:

- PMTiles: `CacheFirst`, long expiration, large entry support.
- Supabase REST: `NetworkFirst`, short timeout, fallback to cached responses.
- Static images/fonts: `CacheFirst`.

### 8.2 IndexedDB

IndexedDB stores:

- Downloaded region metadata.
- Facility snapshots for offline search.
- User-saved POIs.
- Last sync timestamps.

The initial helper is `src/lib/offlineStore.ts`.

### 8.3 Offline download flow

1. User opens Offline tab.
2. User selects "Download region for offline use."
3. Bounding-box selector estimates:
   - Tile byte size
   - Facility record count
   - Terrain overlay byte size
4. App downloads PMTiles file or region shard.
5. App stores region metadata and facility snapshot in IndexedDB.
6. Layers drawer shows downloaded region overlay.

## 9. Local Supabase setup

Install the Supabase CLI, then:

```bash
supabase init
supabase start
supabase migration up
```

Seed facilities with CSV or SQL:

```sql
insert into public.facilities (name, category, geom, address, phone, capacity, status, resources, source)
values
  (
    'General Hospital Emergency Hub',
    'hospital',
    extensions.st_point(-122.4194, 37.7749)::extensions.geography,
    '100 Market St',
    '+1-555-0100',
    240,
    'operational',
    '{"beds": 42, "generator": true, "water": "72h"}',
    'seed'
  );
```

Generate TypeScript types after connecting:

```bash
supabase gen types typescript --local > src/lib/database.types.ts
```

## 10. VPS deployment with Docker and nginx

### 10.1 Build static app image

The scaffold includes a multi-stage `Dockerfile`:

```bash
docker build -t resilience-maps:latest .
```

### 10.2 Run with docker compose

```bash
docker compose up -d --build
```

This serves the built app through nginx on port `8080`.

### 10.3 Production nginx reverse proxy

On the VPS, install nginx and certbot:

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/resilience-maps`:

```nginx
server {
  listen 80;
  server_name maps.example.org;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable and secure it:

```bash
sudo ln -s /etc/nginx/sites-available/resilience-maps /etc/nginx/sites-enabled/resilience-maps
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d maps.example.org
```

### 10.4 Upload PMTiles

For single-region deployments:

```bash
rsync -av public/tiles/resilience-demo.pmtiles deploy@server:/opt/resilience-maps/public/tiles/
```

For larger deployments, store PMTiles in object storage/CDN and set:

```bash
VITE_PMTILES_URL=https://cdn.example.org/tiles/resilience-region.pmtiles
```

Use immutable cache headers for versioned PMTiles files.

## 11. Implementation order

Recommended sequence:

1. Explore map shell, search bar, category chips, layers drawer.
2. Supabase facility viewport queries with IndexedDB fallback.
3. POI detail card and status reporting.
4. Offline downloads list and bounding-box selector.
5. Route preview with elevation/terrain profile.
6. Alert/hazard overlays and verified route workflow.
7. Admin/import tooling for OSM, agency feeds, and manual facility updates.

