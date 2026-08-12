import type { LucideIcon } from 'lucide-react';

export type FacilityCategory = 'hospital' | 'school' | 'shelter' | 'water' | 'power' | 'comms';

export type FacilityStatus = 'operational' | 'limited' | 'closed' | 'unknown';

export type Facility = {
  id: string;
  name: string;
  category: FacilityCategory;
  status: FacilityStatus;
  coordinates: [longitude: number, latitude: number];
  address: string;
  capacity?: number;
  phone?: string;
  lastUpdated: string;
  resources: Record<string, string | number | boolean>;
};

export type CategoryChip = {
  id: FacilityCategory;
  label: string;
  icon: LucideIcon;
  accent: string;
};

export type LayerState = {
  terrain: boolean;
  satellite: boolean;
  offlineRegions: boolean;
  categories: Record<FacilityCategory, boolean>;
};
