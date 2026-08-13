/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_BASEMAP_PMTILES_URL?: string;
  readonly VITE_TERRAIN_PMTILES_URL?: string;
  readonly VITE_SATELLITE_TILES_URL?: string;
  readonly VITE_FALLBACK_RASTER_TILES_URL?: string;
  readonly VITE_DEFAULT_CENTER?: string;
  readonly VITE_DEFAULT_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
