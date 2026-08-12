import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadFacilities, loadHazards } from '@/lib/facilities';
import { hoursSince } from '@/lib/format';
import { isHazardActive } from '@/lib/geo';
import { CAPACITY_BOUNDS, useFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import type { DataSource, Facility, FilterState, Hazard } from '@/types';

interface FacilitiesHook {
  all: Facility[];
  visible: Facility[];
  hazards: Hazard[];
  source: DataSource;
  fetchedAt?: string;
  loading: boolean;
  refresh: () => void;
}

/** Applies the filter sheet and category chips to a facility list. */
export function applyFilters(facilities: Facility[], filters: FilterState): Facility[] {
  const [minCapacity, maxCapacity] = filters.capacityRange;
  const capacityFilterActive =
    minCapacity !== CAPACITY_BOUNDS[0] || maxCapacity !== CAPACITY_BOUNDS[1];

  const filtered = facilities.filter((facility) => {
    if (filters.categories.length > 0 && !filters.categories.includes(facility.category)) {
      return false;
    }
    if (filters.openNow && facility.status !== 'open') return false;
    if (filters.verifiedRecently && hoursSince(facility.verifiedAt) > 24) return false;
    if (filters.hasGenerator && facility.resources.power !== 'available') return false;
    if (filters.hasWater && !['available', 'low'].includes(facility.resources.water ?? '')) {
      return false;
    }
    if (capacityFilterActive) {
      const capacity = facility.capacity ?? 0;
      if (capacity < minCapacity || capacity > maxCapacity) return false;
    }
    if (facility.distanceM !== undefined && facility.distanceM / 1000 > filters.maxDistanceKm) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (filters.sortBy) {
    case 'capacity':
      sorted.sort((a, b) => availableCapacity(b) - availableCapacity(a));
      break;
    case 'updated':
      sorted.sort(
        (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
      );
      break;
    case 'distance':
    default:
      sorted.sort(
        (a, b) => (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER),
      );
      break;
  }
  return sorted;
}

export function availableCapacity(facility: Facility): number {
  if (facility.capacity === undefined) return 0;
  return Math.max(0, facility.capacity - (facility.occupancy ?? 0));
}

export function useFacilities(): FacilitiesHook {
  const reference = useSession((state) => state.reference);
  const filters = useFilters();

  const [all, setAll] = useState<Facility[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [source, setSource] = useState<DataSource>('seed');
  const [fetchedAt, setFetchedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [result, hazardList] = await Promise.all([loadFacilities(reference), loadHazards()]);
      if (cancelled) return;
      setAll(result.facilities);
      setSource(result.source);
      setFetchedAt(result.fetchedAt);
      setHazards(hazardList.filter((hazard) => isHazardActive(hazard)));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reference, nonce]);

  useEffect(() => {
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refresh]);

  const visible = useMemo(() => applyFilters(all, filters), [all, filters]);

  return { all, visible, hazards, source, fetchedAt, loading, refresh };
}
