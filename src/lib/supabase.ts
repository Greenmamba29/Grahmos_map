import { createClient } from '@supabase/supabase-js';
import type { Facility, FacilityCategory } from '@/types/facility';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function fetchFacilitiesNearby(
  lat: number,
  lng: number,
  radiusMeters = 10000,
  categories?: FacilityCategory[],
): Promise<Facility[]> {
  if (!supabase) {
    return getMockFacilities();
  }

  const { data, error } = await supabase.rpc('facilities_nearby', {
    lat,
    lng,
    radius_meters: radiusMeters,
    categories: categories ?? null,
  });

  if (error) {
    console.warn('Supabase query failed, using mock data:', error.message);
    return getMockFacilities();
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    category: row.category as FacilityCategory,
    status: row.status as Facility['status'],
    capacity: row.capacity as number | null,
    capacity_unit: row.capacity_unit as string | null,
    phone: row.phone as string | null,
    website: row.website as string | null,
    description: row.description as string | null,
    resources: (row.resources as Facility['resources']) ?? [],
    lat: 0,
    lng: 0,
    last_updated: row.last_updated as string,
  }));
}

function getMockFacilities(): Facility[] {
  return [
    {
      id: '1',
      name: 'Central Memorial Hospital',
      category: 'hospital',
      status: 'operational',
      capacity: 250,
      capacity_unit: 'beds',
      phone: '+1-555-0100',
      website: null,
      description: 'Full-service emergency hospital',
      resources: [],
      lat: 40.015,
      lng: -105.2705,
      last_updated: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Lincoln Elementary',
      category: 'school',
      status: 'operational',
      capacity: 400,
      capacity_unit: 'seats',
      phone: '+1-555-0101',
      website: null,
      description: 'Community school with shelter capacity',
      resources: [],
      lat: 40.02,
      lng: -105.28,
      last_updated: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Community Shelter A',
      category: 'shelter',
      status: 'limited',
      capacity: 150,
      capacity_unit: 'seats',
      phone: '+1-555-0102',
      website: null,
      description: 'Emergency shelter — limited capacity',
      resources: [],
      lat: 40.01,
      lng: -105.26,
      last_updated: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Municipal Water Plant',
      category: 'water',
      status: 'operational',
      capacity: 50000,
      capacity_unit: 'gallons',
      phone: '+1-555-0103',
      website: null,
      description: 'Primary municipal water source',
      resources: [],
      lat: 40.005,
      lng: -105.25,
      last_updated: new Date().toISOString(),
    },
    {
      id: '5',
      name: 'Tower Ridge Comms',
      category: 'comms',
      status: 'operational',
      capacity: null,
      capacity_unit: null,
      phone: '+1-555-0104',
      website: null,
      description: 'Cell tower and emergency radio relay',
      resources: [],
      lat: 40.025,
      lng: -105.29,
      last_updated: new Date().toISOString(),
    },
  ];
}
