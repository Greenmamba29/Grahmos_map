/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TILES_BASE_URL?: string;
  readonly VITE_MAP_DEFAULT_CENTER_LNG?: string;
  readonly VITE_MAP_DEFAULT_CENTER_LAT?: string;
  readonly VITE_MAP_DEFAULT_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
