export type FacilityCategory =
  | 'hospital'
  | 'school'
  | 'shelter'
  | 'water'
  | 'power'
  | 'comms';

export type FacilityStatus = 'operational' | 'limited' | 'closed' | 'unknown';

export interface Facility {
  id: string;
  name: string;
  category: FacilityCategory;
  status: FacilityStatus;
  capacity: number | null;
  capacity_unit: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  resources: FacilityResource[];
  lat: number;
  lng: number;
  last_updated: string;
}

export interface FacilityResource {
  name: string;
  quantity: number;
  unit: string;
}

export const CATEGORY_LABELS: Record<FacilityCategory, string> = {
  hospital: 'Hospitals',
  school: 'Schools',
  shelter: 'Shelters',
  water: 'Water',
  power: 'Power',
  comms: 'Comms',
};

export const CATEGORY_ICONS: Record<FacilityCategory, string> = {
  hospital: '🏥',
  school: '🏫',
  shelter: '🏠',
  water: '💧',
  power: '⚡',
  comms: '📡',
};

export const STATUS_COLORS: Record<FacilityStatus, string> = {
  operational: '#34A853',
  limited: '#FBBC04',
  closed: '#EA4335',
  unknown: '#9AA0A6',
};
