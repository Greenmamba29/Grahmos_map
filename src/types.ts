export type Category =
  | "hospital"
  | "school"
  | "shelter"
  | "water"
  | "power"
  | "comms";

export type FacilityStatus = "operational" | "degraded" | "down" | "unknown";

export interface Facility {
  id: string;
  name: string;
  category: Category;
  lng: number;
  lat: number;
  address?: string;
  phone?: string;
  capacity?: number;
  occupancy?: number;
  resources: Partial<
    Record<"water" | "generator" | "medical" | "radio" | "food" | "accessible", boolean>
  >;
  status: FacilityStatus;
  statusNote?: string;
  lastUpdated: string; // ISO timestamp
  verifiedBy?: string;
  operator?: string;
  notes?: string;
}

export interface FacilityReport {
  id: string;
  facilityId: string;
  status: FacilityStatus;
  note?: string;
  reporter?: string;
  createdAt: string;
}

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export type RegionState = "downloaded" | "updating" | "update-available" | "downloading";

export interface OfflineRegion {
  id: string;
  name: string;
  bbox: BBox;
  sizeMb: number;
  facilityCount: number;
  downloadedAt: string;
  state: RegionState;
  progress?: number; // 0..1 while downloading
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
  caution?: string;
}

export type TravelMode = "walk" | "bike" | "drive";

export interface RoutePlan {
  mode: TravelMode;
  distanceM: number;
  durationMin: number;
  ascentM: number;
  descentM: number;
  /** Elevation samples (m) along the route, evenly spaced. */
  elevation: number[];
  steps: RouteStep[];
  /** [lng, lat] coordinates of the route line. */
  line: [number, number][];
  caution?: string;
}

export interface AlertItem {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  read?: boolean;
}

export type MapType = "default" | "terrain" | "satellite";

export type TabId = "explore" | "routes" | "saved" | "offline" | "alerts";

export type SortBy = "distance" | "capacity" | "verified";

export interface Filters {
  openNow: boolean;
  verified24h: boolean;
  hasPower: boolean;
  hasWater: boolean;
  accessible: boolean;
  sortBy: SortBy;
  maxDistanceKm: number;
  minCapacity: number;
}
