/**
 * Central, null-safe access to build-time configuration. Every value has a sane
 * default so a missing variable degrades the app rather than crashing it.
 */

function str(value: string | undefined, fallback = ''): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function parseCenter(value: string | undefined, fallback: [number, number]): [number, number] {
  const parts = str(value)
    .split(',')
    .map((part) => Number.parseFloat(part.trim()));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    const [lng, lat] = parts as [number, number];
    if (Math.abs(lng) <= 180 && Math.abs(lat) <= 90) return [lng, lat];
  }
  return fallback;
}

function parseZoom(value: string | undefined, fallback: number): number {
  const zoom = Number.parseFloat(str(value));
  return Number.isFinite(zoom) && zoom >= 0 && zoom <= 22 ? zoom : fallback;
}

const env = import.meta.env;

export const config = {
  supabaseUrl: str(env.VITE_SUPABASE_URL),
  supabaseAnonKey: str(env.VITE_SUPABASE_ANON_KEY),

  basemapPmtilesUrl: str(env.VITE_BASEMAP_PMTILES_URL, '/tiles/region.pmtiles'),
  terrainPmtilesUrl: str(env.VITE_TERRAIN_PMTILES_URL, '/tiles/terrain.pmtiles'),
  satelliteTilesUrl: str(env.VITE_SATELLITE_TILES_URL),
  fallbackRasterTilesUrl: str(
    env.VITE_FALLBACK_RASTER_TILES_URL,
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  ),

  defaultCenter: parseCenter(env.VITE_DEFAULT_CENTER, [-72.335, 18.5392]),
  defaultZoom: parseZoom(env.VITE_DEFAULT_ZOOM, 12),
} as const;

export const hasSupabase = config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;

/** Offline download guardrails. */
export const OFFLINE_LIMITS = {
  minZoom: 6,
  maxZoom: 14,
  /** Refuse a region larger than this many square kilometres. */
  maxAreaKm2: 25_000,
  /** Leave this much of the storage quota free. */
  quotaHeadroom: 0.15,
} as const;
