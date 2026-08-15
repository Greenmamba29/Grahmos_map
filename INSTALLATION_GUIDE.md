# Resilience Maps installation and architecture guide

Resilience Maps is an offline-first field map for finding critical infrastructure when internet access is unreliable. The browser renders MapLibre vector maps from PMTiles archives, keeps region metadata and facility snapshots in IndexedDB, and synchronizes authoritative facility data with Supabase/PostGIS whenever connectivity returns.

## Product surfaces

### 1. Explore map (`/`)

- Full-viewport MapLibre map with vector basemap, optional terrain DEM, facility symbols, downloaded-region outlines, and current-location marker.
- Floating search bar with voice-search affordance and results for facility names, addresses, and categories.
- Horizontal category chips for Hospitals, Schools, Shelters, Water, and Power.
- Circular location and layers controls plus a primary route FAB.
- Bottom navigation: Explore, Routes, Saved, Offline, Alerts.
- Offline/sync status badge and an accessible fallback list for visible facilities.

Primary components: `ExploreMap`, `SearchBar`, `CategoryChips`, `MapCanvas`, `MapControls`, `BottomNav`, `FacilityMarker`, `ConnectivityBadge`.

### 2. Layers control

- Stacked-square map control opens a right-side drawer on wide screens and a bottom drawer on phones.
- Basemap choices: resilience/vector, terrain, and satellite when a licensed satellite package is present.
- Per-category facility visibility toggles.
- Toggle for downloaded-region boundaries and storage state.
- Terrain mode enables hillshade and a DEM source; it must degrade cleanly when no terrain PMTiles URL is configured.

Primary components: `LayersButton`, `LayersDrawer`, `LayerToggle`, `BasemapPicker`, `DownloadOverlayToggle`.

### 3. Facility filters

- Slide-up sheet launched from the filter button.
- Pill filters for category, operating status, verified-only, open-now, and accessibility.
- Segmented sort control: nearest, recently verified, capacity.
- Distance/capacity range slider with a readable numeric value and reset/apply actions.
- Filters update both the PostGIS query and locally cached facility results.

Primary components: `FilterSheet`, `FilterPill`, `SegmentedControl`, `RangeField`.

### 4. Facility detail

- Bottom sheet with facility name, category, status, verification timestamp, distance, and capacity.
- Action pills: Directions, Report Status, Save, Call.
- Tabs: Overview, Capacity, Resources, Updates.
- Offline report queue; queued reports synchronize after reconnecting.

Primary components: `FacilitySheet`, `FacilityActions`, `FacilityTabs`, `ResourceList`, `StatusTimeline`, `QueuedReportForm`.

### 5. Route and directions (`/routes/:id`)

- Map preview with primary/alternate route lines and hazard overlays.
- Travel modes: walk, drive, bicycle, emergency.
- ETA, distance, ascent, and descent summary.
- Elevation/terrain profile chart and numbered turn list.
- Persistent warning banner for unverified or potentially blocked segments.
- Preview and Show map actions. Route packages can be saved with the associated tiles and facilities.

Primary components: `RouteMap`, `TravelModeTabs`, `RouteSummary`, `ElevationProfile`, `TurnList`, `RouteCaution`, `RouteActions`.

### 6. Offline regions (`/offline`)

- Downloaded-region list with name, bounds, zoom range, version, size, last verified time, and state icon.
- “Download region for offline use” CTA opens a map bounding-box selector.
- Live size estimate based on selected area, zooms, tile density, facility payload, and terrain inclusion.
- Pause, resume, update, verify, and delete actions.
- Storage quota meter and warning before downloads that exceed available browser storage.

Primary components: `OfflineRegionsPage`, `RegionCard`, `RegionSelector`, `DownloadEstimate`, `StorageMeter`, `DownloadProgress`.

### Supporting screens

- Saved facilities and routes (`/saved`).
- Alerts and hazard updates (`/alerts`).
- Contribution/report queue (`/contribute`).
- App settings, data freshness, emergency disclaimer, attribution, diagnostics, and cache reset (`/settings`).

## Repository structure

```text
.
├── INSTALLATION_GUIDE.md
├── Dockerfile
├── docker-compose.yml
├── nginx/
│   └── default.conf
├── public/
│   ├── icons/
│   └── offline/
│       └── README.md
├── scripts/
│   └── build-pmtiles.sh
├── src/
│   ├── app/
│   │   └── App.tsx
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapCanvas.tsx
│   │   │   └── LayersDrawer.tsx
│   │   └── ui/
│   │       ├── BottomNav.tsx
│   │       ├── CategoryChips.tsx
│   │       └── SearchBar.tsx
│   ├── data/
│   │   └── demoFacilities.ts
│   ├── hooks/
│   │   └── useFacilities.ts
│   ├── lib/
│   │   ├── offlineDb.ts
│   │   └── supabase.ts
│   ├── types/
│   │   └── facilities.ts
│   ├── main.tsx
│   ├── service-worker.ts
│   └── styles.css
├── supabase/
│   └── migrations/
│       └── 20260812053410_create_facilities.sql
├── .env.example
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

## Required packages

Runtime:

- `react`, `react-dom`: UI runtime.
- `maplibre-gl`: WebGL map renderer.
- `pmtiles`: MapLibre protocol adapter and range-request reader.
- `@supabase/supabase-js`: facility synchronization and PostGIS RPC calls.
- `idb`: typed IndexedDB cache for facilities, offline regions, reports, and preferences.
- `lucide-react`: accessible map and navigation icons.

Build/offline:

- `vite`, `typescript`, `@vitejs/plugin-react`.
- `tailwindcss`, `@tailwindcss/vite`.
- `vite-plugin-pwa`, `workbox-core`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`.
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, ESLint and TypeScript ESLint packages.

Install with:

```bash
npm install
cp .env.example .env.local
```

## Environment variables

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_VECTOR_PMTILES_URL=/offline/region.pmtiles
VITE_TERRAIN_PMTILES_URL=/offline/terrain.pmtiles
VITE_MAP_INITIAL_LNG=36.8219
VITE_MAP_INITIAL_LAT=-1.2921
VITE_MAP_INITIAL_ZOOM=11
```

Only publishable/legacy anon keys belong in browser variables. Never place a Supabase secret or `service_role` key in a `VITE_` variable.

## Supabase/PostGIS data model

The committed migration enables PostGIS, creates a public-read facility catalog, adds spatial/category indexes, and exposes a bounded nearby search function.

Core columns:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | generated primary key |
| `name` | `text` | display/search name |
| `category` | enum | hospital, school, shelter, water, power, communications |
| `geom` | `geography(Point, 4326)` | WGS84 position; meters work naturally in distance queries |
| `capacity` | `integer` | nullable, non-negative |
| `status` | enum | operational, limited, closed, unknown |
| `phone`, `address`, `resources` | text/jsonb | contact and available supplies/services |
| `is_verified` | boolean | trusted confirmation marker |
| `last_updated` | timestamptz | freshness timestamp |

RLS is enabled because `public` is exposed through Supabase’s Data API. Anonymous and authenticated clients receive read-only access; field reports should later be written to a separate RLS-protected queue table rather than allowing public updates to authoritative facilities.

Apply locally:

```bash
npx supabase start
npx supabase db reset
```

Apply to a linked project after reviewing the migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## PMTiles generation pipeline

### Vector basemap

1. Download a regional `.osm.pbf` extract from Geofabrik or produce one with `osmium extract`.
2. Build a vector MBTiles archive with Planetiler and an OpenMapTiles-compatible profile.
3. Convert MBTiles to PMTiles and inspect the result.
4. Copy the archive into `public/offline/` for a bundled pilot region, or host it on object storage/CDN with HTTP byte-range support.

The included script expects Docker, curl, and the PMTiles CLI:

```bash
REGION=kenya \
PBF_URL=https://download.geofabrik.de/africa/kenya-latest.osm.pbf \
./scripts/build-pmtiles.sh
```

For production, pin and audit a Planetiler profile/tag rather than using a floating image. Preserve OpenStreetMap attribution and the source extract timestamp in release metadata.

### Terrain archive

Terrain is a separate raster-dem PMTiles archive:

1. Download Copernicus DEM GLO-30, Mapzen/Tilezen Terrarium, or another licensed DEM for the same bounds.
2. Mosaic and reproject to Web Mercator with GDAL.
3. Encode elevation as Mapbox Terrain-RGB (`height = -10000 + (R*256*256 + G*256 + B) * 0.1`) using `rio-rgbify`.
4. Tile the RGB GeoTIFF to MBTiles for the required zoom range.
5. Convert with `pmtiles convert terrain.mbtiles terrain.pmtiles`.
6. Set `VITE_TERRAIN_PMTILES_URL`; MapLibre uses it as a `raster-dem` source for hillshade and terrain.

Example tool sequence (adapt bounds/resolution to the region):

```bash
gdalbuildvrt build/dem.vrt data/dem/*.tif
gdalwarp -t_srs EPSG:3857 -r bilinear -co TILED=YES build/dem.vrt build/dem-3857.tif
rio rgbify -b -10000 -i 0.1 build/dem-3857.tif build/dem-rgb.tif
rio mbtiles build/dem-rgb.tif build/terrain.mbtiles --format PNG --zoom-levels 6..14
pmtiles convert build/terrain.mbtiles public/offline/terrain.pmtiles
```

DEM redistribution rights vary by source. Verify the license before packaging or hosting terrain data.

### Facility import

Use `osmium tags-filter` or Overpass to extract hospitals, clinics, schools, shelters, drinking-water points, substations/generators, and communications towers. Normalize OSM tags into the facility enums, keep the OSM object ID as `source_id`, and load points using `COPY`/`ogr2ogr`. Polygon facilities should use a representative point (`ST_PointOnSurface`) for mobile discovery while retaining source geometry in a private/import schema if needed.

## Offline architecture

- App shell: Workbox precache manifest generated during `npm run build`.
- Remote style/sprite/font requests: stale-while-revalidate.
- PMTiles: cache successful HTTP range responses; region downloads should additionally persist archive chunks or a complete archive through the File System Access/OPFS path where available.
- Facility snapshots and region metadata: IndexedDB via `idb`.
- Writes such as status reports: IndexedDB outbox with Background Sync when supported and foreground retry otherwise.
- Map startup order: bundled/cached facilities first, Supabase refresh second, then update the cache and visible source.
- A downloaded region is not “ready” until vector archive, optional DEM, facilities, style assets, and integrity/version metadata all verify successfully.

Browser storage is quota-managed and may be evicted. Production mobile deployments should request persistent storage with `navigator.storage.persist()` and clearly show whether it was granted.

## Local development

Prerequisites: Node 22+, npm 10+, Docker with Compose, and optionally the Supabase CLI.

```bash
git clone YOUR_REPOSITORY_URL
cd Grahmos_map
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. Without Supabase variables, the app uses a small built-in facility dataset. Without PMTiles variables, it uses a network OpenStreetMap fallback that Workbox can cache; this fallback is useful for development but is not a complete offline region.

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Test offline behavior in a production build because service workers are disabled during ordinary Vite development. In browser developer tools, install the PWA, load a region, switch the network to Offline, reload, and verify the map, facilities, controls, and attribution.

## VPS deployment with Docker and nginx

### Build and start

1. Point DNS to the VPS and allow ports 80/443.
2. Clone the repository and create `.env.production`.
3. Ensure PMTiles are either in `public/offline` before image build or mounted at `/usr/share/nginx/html/offline`.
4. Build and run:

```bash
docker compose up -d --build
docker compose ps
curl -I http://127.0.0.1:8080
```

The multi-stage image compiles the Vite application and serves static files through nginx. SPA routes fall back to `index.html`; immutable assets are cached aggressively while the service worker and HTML are not.

### PMTiles range requests

nginx serves static files with byte ranges by default. Keep `Accept-Ranges: bytes`, avoid compression of `.pmtiles`, and expose `Content-Range`, `Accept-Ranges`, and `ETag` when the archive is hosted on a different origin. Cross-origin object storage must allow `GET`, `HEAD`, and the `Range` request header.

### TLS

Run a host-level reverse proxy (Caddy, Traefik, or nginx + Certbot) in front of port 8080. Service workers and geolocation require HTTPS outside localhost. Example host nginx proxy:

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

### Release checklist

- Confirm HTTPS, geolocation, service-worker registration, and update behavior.
- Verify all configured PMTiles URLs support byte ranges and have immutable versioned names.
- Test a cold offline launch on each target browser.
- Check OSM/data-provider attribution and DEM/satellite licenses.
- Run Supabase security and performance advisors; confirm RLS and grants.
- Back up Supabase and retain the previous PMTiles manifests for rollback.
- Monitor cache errors, tile range failures, stale facility counts, and report outbox depth without collecting sensitive precise-location history.

## Implementation sequence

1. Explore map, category chips, search shell, location control, bottom navigation.
2. PMTiles/vector and terrain source configuration, layers drawer, facility markers.
3. IndexedDB facility cache, sync state, and Workbox production service worker.
4. Filter and facility detail sheets.
5. Offline region selector/download manager and quota handling.
6. Routing engine integration, terrain profile, hazard overlays, saved routes.
7. Reports/outbox, alerts, accessibility audit, offline failure testing, and operational telemetry.
