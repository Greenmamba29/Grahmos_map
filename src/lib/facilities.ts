import { SEED_FACILITIES } from '@/data/facilities.seed';
import { SEED_HAZARDS } from '@/data/hazards.seed';
import { facilityCache, hazardCache, outboxStore, updateStore } from '@/lib/db';
import { haversineM } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
import type {
  Facility,
  FacilitiesResult,
  FacilityStatus,
  FacilityUpdate,
  Hazard,
} from '@/types';

/**
 * Facility repository.
 *
 * Read order is deliberate and never changes: network (only when online and
 * configured) → IndexedDB snapshot → bundled seed. A successful network read
 * always writes back to IndexedDB so the next cold start offline is current.
 */

interface NearbyRow {
  id: string;
  name: string;
  category: Facility['category'];
  status: FacilityStatus;
  lng: number;
  lat: number;
  distance_m: number | null;
  capacity: number | null;
  occupancy: number | null;
  resources: Facility['resources'] | null;
  address: string | null;
  contact_phone: string | null;
  notes: string | null;
  verified_at: string | null;
  last_updated: string;
}

function fromRow(row: NearbyRow): Facility {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    lng: row.lng,
    lat: row.lat,
    address: row.address ?? undefined,
    capacity: row.capacity ?? undefined,
    occupancy: row.occupancy ?? undefined,
    resources: row.resources ?? {},
    contactPhone: row.contact_phone ?? undefined,
    notes: row.notes ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    lastUpdated: row.last_updated,
    distanceM: row.distance_m ?? undefined,
  };
}

function withDistance(facilities: Facility[], from: [number, number]): Facility[] {
  return facilities.map((facility) => ({
    ...facility,
    distanceM: haversineM(from, [facility.lng, facility.lat]),
  }));
}

export async function loadFacilities(
  reference: [number, number],
  options: { radiusM?: number; forceOffline?: boolean } = {},
): Promise<FacilitiesResult> {
  const { radiusM = 40_000, forceOffline = false } = options;
  const online = navigator.onLine && !forceOffline;

  if (supabase && online) {
    try {
      const { data, error } = await supabase.rpc('facilities_nearby', {
        in_lng: reference[0],
        in_lat: reference[1],
        in_radius_m: radiusM,
        in_limit: 500,
      });
      if (error) throw error;
      const facilities = ((data ?? []) as NearbyRow[]).map(fromRow);
      if (facilities.length > 0) {
        const fetchedAt = new Date().toISOString();
        await facilityCache.put(facilities, fetchedAt);
        return { facilities, source: 'network', fetchedAt };
      }
    } catch (error) {
      console.warn('[facilities] network read failed, falling back to cache', error);
    }
  }

  const cached = await facilityCache.all();
  if (cached.length > 0) {
    return {
      facilities: withDistance(cached, reference),
      source: 'cache',
      fetchedAt: await facilityCache.fetchedAt(),
    };
  }

  return { facilities: withDistance(SEED_FACILITIES, reference), source: 'seed' };
}

export async function loadHazards(options: { forceOffline?: boolean } = {}): Promise<Hazard[]> {
  const online = navigator.onLine && !options.forceOffline;

  if (supabase && online) {
    try {
      const { data, error } = await supabase
        .from('hazards')
        .select('id, kind, severity, description, reported_at, expires_at, lng, lat, radius_m');
      if (error) throw error;
      const hazards = (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        kind: row.kind as Hazard['kind'],
        severity: (row.severity ?? 1) as Hazard['severity'],
        lng: Number(row.lng),
        lat: Number(row.lat),
        radiusM: Number(row.radius_m ?? 500),
        description: (row.description as string | null) ?? undefined,
        reportedAt: String(row.reported_at),
        expiresAt: (row.expires_at as string | null) ?? undefined,
      })) satisfies Hazard[];
      if (hazards.length > 0) {
        await hazardCache.put(hazards);
        return hazards;
      }
    } catch (error) {
      console.warn('[hazards] network read failed, falling back to cache', error);
    }
  }

  const cached = await hazardCache.all();
  return cached.length > 0 ? cached : SEED_HAZARDS;
}

export async function loadFacilityUpdates(facilityId: string): Promise<FacilityUpdate[]> {
  const queued = (await outboxStore.all()).filter((item) => item.facilityId === facilityId);

  if (supabase && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('facility_updates')
        .select('id, facility_id, status, capacity, occupancy, message, reporter, reported_at, client_id')
        .eq('facility_id', facilityId)
        .order('reported_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const updates = (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        facilityId: String(row.facility_id),
        status: row.status as FacilityStatus,
        capacity: (row.capacity as number | null) ?? undefined,
        occupancy: (row.occupancy as number | null) ?? undefined,
        message: (row.message as string | null) ?? undefined,
        reporter: (row.reporter as string | null) ?? undefined,
        reportedAt: String(row.reported_at),
        clientId: String(row.client_id ?? row.id),
      })) satisfies FacilityUpdate[];
      await updateStore.put(updates);
      return dedupe([...queued, ...updates]);
    } catch (error) {
      console.warn('[updates] network read failed, falling back to cache', error);
    }
  }

  const cached = await updateStore.byFacility(facilityId);
  return dedupe([...queued, ...cached]);
}

function dedupe(updates: FacilityUpdate[]): FacilityUpdate[] {
  const seen = new Map<string, FacilityUpdate>();
  for (const update of updates) {
    if (!seen.has(update.clientId)) seen.set(update.clientId, update);
  }
  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
  );
}

export function searchFacilities(facilities: Facility[], query: string): Facility[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  return facilities
    .filter((facility) => {
      const haystack = `${facility.name} ${facility.address ?? ''} ${facility.category} ${facility.notes ?? ''}`;
      return haystack.toLowerCase().includes(needle);
    })
    .slice(0, 25);
}
