# Resilience Maps — installation and implementation guide

Resilience Maps is an installable, offline-first web map for finding critical
infrastructure when connectivity is limited. The browser reads vector and
terrain tiles directly from PMTiles archives, while Supabase/PostGIS supplies
fresh facility records whenever a connection is available.

## 1. Product screens and components

### Explore

The initial screen is a full-bleed MapLibre map with:

- `SearchBar`: rounded search field, search affordance, microphone button, and
  an offline/online state badge.
- `CategoryChips`: horizontally scrollable filters for Hospitals, Schools,
  Shelters, Water, and Power.
- `LayersButton` and `LayersDrawer`: terrain and satellite basemap choices,
  independent facility category overlays, and downloaded-region boundaries.
- `MapCanvas`: PMTiles protocol registration, vector basemap, optional
  raster-dem terrain, facility symbols, selected-point state, geolocation, and
  attribution.
- `MapControls`: a locate button and a larger route action.
- `BottomNav`: Explore, Routes, Saved, Offline, and Alerts destinations.
- `OfflineBanner`: a compact explanation when only cached data is available.

### Facility filter sheet

`FacilityFilterSheet` is a draggable bottom sheet containing:

- pill toggles for category, status, verified recently, open now, and
  accessibility;
- a segmented sort control for nearest, capacity, and most recently updated;
- distance and minimum-capacity range controls;
- Reset and Show results actions.

The Explore category chips apply immediately. Advanced values are encoded in a
`FacilityFilter` object so the same filter can be used for online PostGIS RPC
queries and local IndexedDB queries.

### Facility detail

`FacilityDetailSheet` contains:

- facility name, category, operational status, verification time, and distance;
- actions for Directions, Report status, Save, and Call;
- tabs for Overview, Capacity, Resources, and Updates;
- capacity, accessibility, contact details, resources, and reporter confidence;
- a visible stale-data warning when the last update exceeds the configured
  freshness threshold.

### Routes

`RouteScreen` contains:

- a top map with route line, origin/destination markers, and hazard overlays;
- mode tabs for Walking, Driving, Cycling, and Emergency;
- ETA, distance, ascent, and descent summary;
- `ElevationProfile` terrain chart;
- numbered turn-by-turn instructions;
- a resilience warning that routes may be blocked or unverified;
- Preview and Show map actions.

Offline routing should use a region-specific routing graph downloaded alongside
the PMTiles archive. A later routing worker can use `@project-osrm/osrm` on the
server or a WebAssembly engine in-browser; straight-line fallback must be
labelled as such and never presented as a verified route.

### Offline regions

`OfflineRegionsScreen` contains:

- a prominent “Download region for offline use” action;
- a map bounding-box selector with a live PMTiles, facility, routing, and total
  size estimate;
- downloaded region cards with size, version, last refresh, integrity state,
  and pause/resume/delete controls;
- storage quota and available-space indicators;
- per-item states for queued, downloading, verifying, ready, stale, and failed.

`OfflineRegionManager` stores metadata and facility snapshots in IndexedDB.
PMTiles archives are stored in Cache Storage or the Origin Private File System
when available. Downloads must be resumable and verified against a published
SHA-256 digest before becoming active.

### Alerts

`AlertsScreen` lists outage, hazard, facility-status, and route-verification
notices. Alerts retain their source, severity, affected region, issue time, and
expiry time. Cached alerts remain visible offline but are clearly marked stale.

## 2. Repository layout

```text
.
├── public/
│   ├── icons/
│   ├── data/
│   │   ├── demo-facilities.json
│   │   └── README.md
│   └── manifest.webmanifest
├── scripts/
│   └── build-region.sh
├── src/
│   ├── components/
│   │   ├── BottomNav.tsx
│   │   ├── CategoryChips.tsx
│   │   ├── LayersDrawer.tsx
│   │   ├── MapControls.tsx
│   │   ├── MapLegend.tsx
│   │   ├── SearchBar.tsx
│   │   └── StatusBanner.tsx
│   ├── data/
│   │   └── demoFacilities.ts
│   ├── features/
│   │   ├── alerts/
│   │   ├── facilities/
│   │   ├── offline/
│   │   └── routes/
│   ├── hooks/
│   │   ├── useConnectivity.ts
│   │   └── useFacilities.ts
│   ├── lib/
│   │   ├── db.ts
│   │   ├── mapStyle.ts
│   │   ├── pmtiles.ts
│   │   └── supabase.ts
│   ├── screens/
│   │   └── ExploreScreen.tsx
│   ├── types/
│   │   └── map.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── sw.ts
├── supabase/
│   └── migrations/
│       └── 20260812053715_create_facilities.sql
├── deploy/
│   └── nginx.conf
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── INSTALLATION_GUIDE.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

The initial scaffold implements Explore and its map, category chips, connectivity
state, controls, and layers drawer. The feature folders are extension points for
the remaining screens.

## 3. Runtime and npm packages

Use Node.js 22 LTS or newer and npm 10 or newer.

Runtime:

- `react`, `react-dom`: interface runtime.
- `maplibre-gl`: WebGL vector map renderer.
- `pmtiles`: `pmtiles://` MapLibre protocol and range-request archive reader.
- `@supabase/supabase-js`: typed PostgREST and realtime client.
- `idb`: small promise-based IndexedDB wrapper.
- `lucide-react`: interface icons.
- `clsx`: conditional class composition.

Build and offline support:

- `vite`, `typescript`, `@vitejs/plugin-react`.
- `tailwindcss`, `@tailwindcss/vite`.
- `vite-plugin-pwa`, `workbox-core`, `workbox-precaching`,
  `workbox-routing`, `workbox-strategies`, and `workbox-expiration`.
- `eslint`, TypeScript ESLint, React Hooks lint rules.
- `vitest`, Testing Library, and jsdom for component/unit tests.

Install exactly what is declared by the lockfile:

```bash
npm ci
```

To reproduce the dependency selection from scratch, use package-manager
resolution rather than copying version numbers:

```bash
npm install react react-dom maplibre-gl pmtiles \
  @supabase/supabase-js idb lucide-react clsx
npm install -D vite typescript @vitejs/plugin-react tailwindcss \
  @tailwindcss/vite vite-plugin-pwa workbox-core workbox-precaching \
  workbox-routing workbox-strategies workbox-expiration eslint \
  @eslint/js typescript-eslint eslint-plugin-react-hooks \
  eslint-plugin-react-refresh vitest @testing-library/react \
  @testing-library/jest-dom jsdom
```

## 4. Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_MAP_PM_TILES_URL=/tiles/region.pmtiles
VITE_TERRAIN_PM_TILES_URL=/tiles/terrain.pmtiles
VITE_SATELLITE_PM_TILES_URL=/tiles/satellite.pmtiles
```

Only a Supabase publishable key belongs in browser configuration. Never expose a
secret or `service_role` key. Tile URLs can be same-origin paths or CORS-enabled
object-storage URLs. PMTiles requires byte-range responses.

The app has a lightweight demo basemap and sample facilities when PMTiles or
Supabase variables are absent, so the interface remains testable after cloning.

## 5. PMTiles generation from OpenStreetMap

### Recommended production pipeline: Geofabrik + Planetiler

The Protomaps basemap Planetiler profile emits a vector PMTiles archive with a
known layer schema that can be styled consistently.

1. Install Docker, `curl`, and at least 8 GB RAM for a small country/region.
2. Download the regional OSM PBF and optional polygon boundary:

   ```bash
   mkdir -p data tiles
   curl -L https://download.geofabrik.de/africa/kenya-latest.osm.pbf \
     -o data/region.osm.pbf
   ```

3. Run the pinned Planetiler basemap image or JAR version approved for the
   deployment. Record that version in release metadata:

   ```bash
   docker run --rm -v "$PWD/data:/data" -v "$PWD/tiles:/tiles" \
     ghcr.io/onthegomap/planetiler:latest \
     --download=false \
     --osm_path=/data/region.osm.pbf \
     --output=/tiles/region.pmtiles \
     --area=planet
   ```

   For production, replace `latest` with a tested immutable version. The
   `scripts/build-region.sh` helper accepts input/output paths and preserves the
   selected image in logs.

4. Inspect and verify:

   ```bash
   pmtiles show tiles/region.pmtiles
   pmtiles verify tiles/region.pmtiles
   sha256sum tiles/region.pmtiles > tiles/region.pmtiles.sha256
   ```

5. Publish the archive and digest. Configure `Accept-Ranges: bytes`, preserve
   `206 Partial Content`, set `Content-Type: application/vnd.pmtiles`, and allow
   `GET`, `HEAD`, and the `Range` request header in CORS.

### Small thematic facility layers: osmium + Tippecanoe

For small extracts or custom layers, filter OSM tags and tile GeoJSON directly:

```bash
osmium tags-filter data/region.osm.pbf \
  nwr/amenity=hospital,school,shelter \
  nwr/emergency=shelter \
  nwr/man_made=water_tower,communications_tower \
  nwr/power=plant,substation \
  -o data/facilities.osm.pbf

ogr2ogr -f GeoJSON -t_srs EPSG:4326 data/facilities.geojson \
  data/facilities.osm.pbf points

tippecanoe -o tiles/facilities.pmtiles -l facilities \
  -zg --drop-densest-as-needed data/facilities.geojson

pmtiles verify tiles/facilities.pmtiles
```

Tippecanoe 2.17+ can write PMTiles directly. Existing MBTiles archives can be
converted with `pmtiles convert input.mbtiles output.pmtiles`, then optimized
and verified.

### Terrain and satellite

OSM does not contain elevation or satellite imagery. Terrain must come from a
licensed DEM such as Copernicus DEM, SRTM, or a provider that permits offline
redistribution. Satellite imagery requires a separate license that explicitly
allows download and offline use.

1. Mosaic and clip source GeoTIFFs to the download region with GDAL.
2. Reproject to the source requirements and encode a MapLibre-supported DEM
   encoding (`terrarium` or `mapbox`).
3. Produce 512 px raster PMTiles with `rio-pmtiles`:

   ```bash
   pip install rio-pmtiles
   rio pmtiles data/terrain.tif tiles/terrain.pmtiles \
     --format WEBP --tile-size 512 --resampling bilinear
   ```

4. Verify rendering and elevation samples before publishing. Do not call a
   hillshade-only visual archive a routing DEM; route elevation requires actual
   numeric elevation samples.

## 6. Supabase/PostGIS schema

The committed migration enables PostGIS in the `extensions` schema and creates:

```sql
create type public.facility_category as enum (
  'hospital', 'school', 'shelter', 'water', 'power', 'communications'
);

create type public.facility_status as enum (
  'operational', 'limited', 'closed', 'unknown'
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  category public.facility_category not null,
  geom extensions.geography(point, 4326) not null,
  capacity integer check (capacity is null or capacity >= 0),
  status public.facility_status not null default 'unknown',
  address text,
  phone text,
  resources jsonb not null default '{}'::jsonb,
  source text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index facilities_geom_gix on public.facilities using gist (geom);
create index facilities_category_status_idx
  on public.facilities (category, status);
```

The migration also:

- enables row-level security;
- grants anonymous/authenticated clients read-only access through a `SELECT`
  policy;
- exposes a `facilities_in_view` SQL function with an explicit empty
  `search_path`, longitude/latitude output, category filters, and a row limit;
- keeps writes unavailable to public clients. Status reports should later go to
  a separate append-only moderation table.

Apply locally:

```bash
npx supabase start
npx supabase db reset
```

For a hosted project, link and push after reviewing the target:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 7. Local development

Prerequisites: Node 22+, npm 10+, Docker (for local Supabase and deployment
tests), and a WebGL2-capable browser.

```bash
git clone YOUR_REPOSITORY_URL resilience-maps
cd resilience-maps
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. Then verify:

```bash
npm run lint
npm run test
npm run build
npm run preview
```

Service workers are enabled for production builds. Use `npm run preview` to test
installation and offline behavior; development mode intentionally avoids a
sticky production cache.

To test an offline archive, place it outside Git under `public/tiles/` and set:

```dotenv
VITE_MAP_PM_TILES_URL=/tiles/region.pmtiles
```

Do not commit large archives to Git. Use object storage or deployment volumes.

## 8. VPS deployment with Docker and nginx

### Build and run

1. Provision a Linux VPS with Docker Engine and the Compose plugin.
2. Clone the repository and create `.env.production` with public runtime build
   variables.
3. Put PMTiles archives in `/srv/resilience-maps/tiles`.
4. Build and start:

   ```bash
   docker compose build --pull
   docker compose up -d
   docker compose ps
   curl -I http://127.0.0.1:8080/
   curl -H 'Range: bytes=0-127' -I \
     http://127.0.0.1:8080/tiles/region.pmtiles
   ```

The second request must return `206 Partial Content` and `Accept-Ranges: bytes`.

### TLS and public reverse proxy

The included container serves the SPA and tiles on port 8080. On the VPS, place
it behind a host-level nginx or Caddy TLS endpoint:

```nginx
server {
  listen 443 ssl http2;
  server_name maps.example.org;

  ssl_certificate /etc/letsencrypt/live/maps.example.org/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/maps.example.org/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

Issue and renew certificates with the platform’s normal ACME process. HTTPS is
required for service workers and geolocation outside localhost.

### Operations checklist

- Publish immutable PMTiles file names (for example,
  `nairobi-2026-08-12.pmtiles`) and update region manifests atomically.
- Keep nginx range requests enabled; do not force full-archive proxy buffering.
- Configure firewall access only for SSH, HTTP, and HTTPS.
- Back up Supabase data and the region metadata manifest; PMTiles can be rebuilt.
- Monitor disk, archive checksums, TLS expiry, service-worker errors, and stale
  facility percentages.
- Test a cold offline launch, map pan/zoom, facility filtering, and saved region
  integrity before each release.
- Preserve OpenStreetMap and source-data attribution in the UI and documentation.

## 9. Implementation sequence

1. Explore map shell, category chips, PMTiles protocol, demo facilities, layer
   controls, geolocation, and responsive bottom navigation.
2. Supabase viewport query plus IndexedDB facility snapshot and freshness rules.
3. Filter and facility-detail sheets.
4. Region selector, resumable archive downloads, quota checks, and verification.
5. Route engine, hazard overlays, elevation profile, and turn list.
6. Saved facilities, status-report moderation, and alerts.
7. Accessibility, localization, telemetry opt-in, and field/offline testing.

Safety-critical labels must distinguish reported, verified, stale, and unknown
information. The map is a decision-support tool, not a guarantee that a facility
is open or a route is passable.
