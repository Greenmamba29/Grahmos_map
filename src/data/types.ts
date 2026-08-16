export type FacilityCategory =
  | "hospital"
  | "school"
  | "shelter"
  | "water"
  | "power"
  | "comms";

export type FacilityStatus = "operational" | "limited" | "offline" | "unknown";

export interface Facility {
  id: string;
  name: string;
  category: FacilityCategory;
  lat: number;
  lng: number;
  address?: string;
  capacity?: number;
  capacityUnit?: string;
  occupancy?: number;
  status: FacilityStatus;
  resources: string[];
  contactPhone?: string;
  description?: string;
  lastUpdated: string;
}

export interface StatusReport {
  id: string;
  facilityId: string;
  reportedStatus: FacilityStatus;
  note?: string;
  createdAt: string;
}

export type OfflineRegionStatus =
  | "queued"
  | "downloading"
  | "ready"
  | "stale"
  | "failed";

export interface OfflineRegion {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  categories: FacilityCategory[];
  sizeEstimateMb: number;
  status: OfflineRegionStatus;
  downloadedAt?: string;
}

interface CategoryMeta {
  label: string;
  color: string;
}

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

export const CATEGORY_META: Record<FacilityCategory, CategoryMeta> = {
  hospital: { label: "Hospitals", color: "#D93025" },
  school: { label: "Schools", color: "#7B1FA2" },
  shelter: { label: "Shelters", color: "#1A73E8" },
  water: { label: "Water", color: "#00838F" },
  power: { label: "Power", color: "#F9AB00" },
  comms: { label: "Communications", color: "#5F6368" },
};

export const STATUS_META: Record<FacilityStatus, StatusMeta> = {
  operational: { label: "Operational", color: "#137333", bg: "#E6F4EA" },
  limited: { label: "Limited", color: "#B06000", bg: "#FEF7E0" },
  offline: { label: "Offline", color: "#C5221F", bg: "#FCE8E6" },
  unknown: { label: "Unknown", color: "#5F6368", bg: "#F1F3F4" },
};
