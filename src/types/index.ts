export type FacilityCategory = 'hospital' | 'school' | 'shelter' | 'water' | 'power' | 'comms';

export type FacilityStatus = 'open' | 'limited' | 'closed' | 'unknown';

export type ResourceKey = 'power' | 'water' | 'oxygen' | 'fuel' | 'beds' | 'food' | 'medical';

export type ResourceAvailability = 'available' | 'low' | 'out' | 'unknown';

export type FacilityResources = Partial<Record<ResourceKey, ResourceAvailability>>;

export interface Facility {
  id: string;
  name: string;
  category: FacilityCategory;
  status: FacilityStatus;
  lng: number;
  lat: number;
  address?: string;
  capacity?: number;
  occupancy?: number;
  resources: FacilityResources;
  contactPhone?: string;
  notes?: string;
  /** ISO timestamp of the last field verification. */
  verifiedAt?: string;
  lastUpdated: string;
  /** Metres from the active reference point; computed client-side. */
  distanceM?: number;
}

export interface FacilityUpdate {
  id: string;
  facilityId: string;
  status: FacilityStatus;
  capacity?: number;
  occupancy?: number;
  message?: string;
  reporter?: string;
  reportedAt: string;
  /** Idempotency key so an outbox replay cannot duplicate a report. */
  clientId: string;
  /** Present only while the report is still queued locally. */
  pending?: boolean;
}

export type HazardKind = 'flood' | 'landslide' | 'blocked_road' | 'fire' | 'conflict' | 'outage';

export interface Hazard {
  id: string;
  kind: HazardKind;
  /** 1 (advisory) to 5 (impassable). Severity >= 4 is hard-excluded from routes. */
  severity: 1 | 2 | 3 | 4 | 5;
  lng: number;
  lat: number;
  /** Affected radius in metres. */
  radiusM: number;
  description?: string;
  reportedAt: string;
  expiresAt?: string;
}

export type BasemapId = 'default' | 'terrain' | 'satellite';

export interface LayerToggles {
  hillshade: boolean;
  hazards: boolean;
  downloadedRegions: boolean;
  labels: boolean;
}

export type SortKey = 'distance' | 'capacity' | 'updated';

export interface FilterState {
  categories: FacilityCategory[];
  openNow: boolean;
  verifiedRecently: boolean;
  hasGenerator: boolean;
  hasWater: boolean;
  sortBy: SortKey;
  /** Inclusive [min, max] capacity in people/beds. */
  capacityRange: [number, number];
  /** Max distance from the reference point, in kilometres. */
  maxDistanceKm: number;
}

export type TravelMode = 'drive' | 'truck' | 'foot' | 'boat';

export interface RouteStep {
  index: number;
  instruction: string;
  distanceM: number;
  durationS: number;
  /** Warning surfaced inline on the step row. */
  warning?: string;
  lng: number;
  lat: number;
}

export interface ElevationSample {
  /** Cumulative distance along the route, in metres. */
  distanceM: number;
  elevationM: number;
  /** Hazard severity affecting this sample, if any. */
  hazardSeverity?: number;
}

export interface RoutePlan {
  mode: TravelMode;
  origin: [number, number];
  destination: [number, number];
  destinationName: string;
  distanceM: number;
  durationS: number;
  ascentM: number;
  descentM: number;
  maxGradePct: number;
  coordinates: [number, number][];
  steps: RouteStep[];
  elevation: ElevationSample[];
  avoidedHazards: Hazard[];
  /** Hazards the route still crosses because no alternative exists. */
  crossedHazards: Hazard[];
  /** Age in hours of the oldest road-condition report along the route. */
  staleHours: number;
}

export type RegionStatus = 'downloaded' | 'downloading' | 'stale' | 'failed' | 'queued';

export interface OfflineRegion {
  id: string;
  name: string;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  sizeBytes: number;
  facilityCount: number;
  status: RegionStatus;
  progress: number;
  downloadedAt?: string;
  expiresAt?: string;
  error?: string;
}

export interface AlertItem {
  id: string;
  kind: 'hazard' | 'status' | 'sync' | 'system';
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  at: string;
  facilityId?: string;
}

export type DataSource = 'network' | 'cache' | 'seed';

export interface FacilitiesResult {
  facilities: Facility[];
  source: DataSource;
  /** ISO timestamp of when this data was pulled from the network. */
  fetchedAt?: string;
}
