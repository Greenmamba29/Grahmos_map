import { useEffect, useState } from 'react';
import type { FacilityCategory } from '@/types/facility';
import { fetchFacilitiesNearby } from '@/lib/supabase';

export function useFacilities(
  lat: number,
  lng: number,
  activeCategories: FacilityCategory[],
) {
  const [facilities, setFacilities] = useState<Awaited<ReturnType<typeof fetchFacilitiesNearby>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchFacilitiesNearby(lat, lng, 10000, activeCategories.length > 0 ? activeCategories : undefined)
      .then((data) => {
        if (!cancelled) setFacilities(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, activeCategories.join(',')]);

  return { facilities, loading };
}
