import type { Category, FacilityStatus } from "./types";

function parseCenter(raw: string | undefined): [number, number] {
  if (!raw) return [-122.4194, 37.7749];
  const [lng, lat] = raw.split(",").map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : [-122.4194, 37.7749];
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  basemapPmtilesUrl: import.meta.env.VITE_BASEMAP_PMTILES_URL as string | undefined,
  terrainPmtilesUrl: import.meta.env.VITE_TERRAIN_PMTILES_URL as string | undefined,
  defaultCenter: parseCenter(import.meta.env.VITE_DEFAULT_CENTER as string | undefined),
  defaultZoom: Number(import.meta.env.VITE_DEFAULT_ZOOM ?? 13),
};

export interface CategoryMeta {
  id: Category;
  label: string;
  /** Icon id understood by <Icon />. */
  icon: string;
  /** Marker/chip accent color. */
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "hospital", label: "Hospitals", icon: "hospital", color: "#d93025" },
  { id: "school", label: "Schools", icon: "school", color: "#f29900" },
  { id: "shelter", label: "Shelters", icon: "shelter", color: "#1a73e8" },
  { id: "water", label: "Water", icon: "water", color: "#12b5cb" },
  { id: "power", label: "Power", icon: "power", color: "#9334e6" },
  { id: "comms", label: "Comms", icon: "comms", color: "#188038" },
];

export const CATEGORY_META: Record<Category, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<Category, CategoryMeta>;

export const STATUS_META: Record<
  FacilityStatus,
  { label: string; color: string; bg: string }
> = {
  operational: { label: "Operational", color: "#188038", bg: "#e6f4ea" },
  degraded: { label: "Degraded", color: "#b06000", bg: "#fef7e0" },
  down: { label: "Down", color: "#d93025", bg: "#fce8e6" },
  unknown: { label: "Unknown", color: "#5f6368", bg: "#f1f3f4" },
};

/** Rough vector-tile size estimate for the offline download size preview. */
export const TILE_KB_PER_KM2_AT_Z14 = 5.2;
