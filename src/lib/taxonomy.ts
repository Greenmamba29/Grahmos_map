import {
  Droplet,
  GraduationCap,
  Hospital,
  House,
  RadioTower,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { FacilityCategory, FacilityStatus, HazardKind, ResourceAvailability } from '@/types';

export interface CategoryMeta {
  id: FacilityCategory;
  label: string;
  /** Chip label, kept short enough for the horizontal scroller. */
  chipLabel: string;
  icon: LucideIcon;
  color: string;
  /** Unit shown next to a capacity number. */
  capacityUnit: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'hospital',
    label: 'Hospitals & clinics',
    chipLabel: 'Hospitals',
    icon: Hospital,
    color: '#d93025',
    capacityUnit: 'beds',
  },
  {
    id: 'school',
    label: 'Schools',
    chipLabel: 'Schools',
    icon: GraduationCap,
    color: '#7b1fa2',
    capacityUnit: 'students',
  },
  {
    id: 'shelter',
    label: 'Shelters',
    chipLabel: 'Shelters',
    icon: House,
    color: '#1a73e8',
    capacityUnit: 'people',
  },
  {
    id: 'water',
    label: 'Water sources',
    chipLabel: 'Water',
    icon: Droplet,
    color: '#0097a7',
    capacityUnit: 'L/day',
  },
  {
    id: 'power',
    label: 'Power infrastructure',
    chipLabel: 'Power',
    icon: Zap,
    color: '#f9ab00',
    capacityUnit: 'kW',
  },
  {
    id: 'comms',
    label: 'Comms towers',
    chipLabel: 'Comms',
    icon: RadioTower,
    color: '#3c8039',
    capacityUnit: 'links',
  },
];

const CATEGORY_INDEX = new Map(CATEGORIES.map((meta) => [meta.id, meta]));

export function categoryMeta(category: FacilityCategory): CategoryMeta {
  return CATEGORY_INDEX.get(category) ?? CATEGORIES[0];
}

export interface StatusMeta {
  label: string;
  color: string;
  softColor: string;
}

export const STATUS_META: Record<FacilityStatus, StatusMeta> = {
  open: { label: 'Open', color: '#188038', softColor: '#e6f4ea' },
  limited: { label: 'Limited', color: '#f9ab00', softColor: '#fef7e0' },
  closed: { label: 'Closed', color: '#d93025', softColor: '#fce8e6' },
  unknown: { label: 'Unverified', color: '#5f6368', softColor: '#f1f3f4' },
};

export const RESOURCE_LABELS: Record<string, string> = {
  power: 'Power',
  water: 'Water',
  oxygen: 'Oxygen',
  fuel: 'Fuel',
  beds: 'Beds',
  food: 'Food',
  medical: 'Medical supplies',
};

export const AVAILABILITY_META: Record<ResourceAvailability, { label: string; color: string }> = {
  available: { label: 'Available', color: '#188038' },
  low: { label: 'Running low', color: '#f9ab00' },
  out: { label: 'Out', color: '#d93025' },
  unknown: { label: 'Unknown', color: '#5f6368' },
};

export const HAZARD_LABELS: Record<HazardKind, string> = {
  flood: 'Flooding',
  landslide: 'Landslide',
  blocked_road: 'Blocked road',
  fire: 'Fire',
  conflict: 'Security incident',
  outage: 'Power outage',
};

export function hazardColor(severity: number): string {
  if (severity >= 4) return '#d93025';
  if (severity === 3) return '#f9ab00';
  return '#5f6368';
}
