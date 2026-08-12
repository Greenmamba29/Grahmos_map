import { useEffect, useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { loadFacilities, haversineKm } from "../data/facilitiesRepo";
import { readSavedIds } from "../data/idb";
import { env } from "../config";
import type { Facility } from "../types";

/** Loads facilities once (offline-first) into the store. */
export function useLoadFacilities() {
  const setFacilities = useAppStore((s) => s.setFacilities);
  const setSavedIds = useAppStore((s) => s.setSavedIds);

  useEffect(() => {
    void loadFacilities().then(setFacilities);
    void readSavedIds().then(setSavedIds);
  }, [setFacilities, setSavedIds]);
}

/** Facilities after applying the chip + filter-sheet criteria, sorted. */
export function useFilteredFacilities(): (Facility & { distanceKm: number })[] {
  const facilities = useAppStore((s) => s.facilities);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const filters = useAppStore((s) => s.filters);
  const categoryVisibility = useAppStore((s) => s.layers.categoryVisibility);
  const userLocation = useAppStore((s) => s.userLocation);

  return useMemo(() => {
    const origin = userLocation ?? {
      lng: env.defaultCenter[0],
      lat: env.defaultCenter[1],
    };
    const dayAgo = Date.now() - 24 * 3600_000;

    const result = facilities
      .filter((f) => categoryVisibility[f.category])
      .filter((f) => !activeCategory || f.category === activeCategory)
      .filter((f) => !filters.openNow || f.status === "operational")
      .filter(
        (f) => !filters.verified24h || new Date(f.lastUpdated).getTime() >= dayAgo,
      )
      .filter((f) => !filters.hasPower || f.resources.generator)
      .filter((f) => !filters.hasWater || f.resources.water)
      .filter((f) => !filters.accessible || f.resources.accessible)
      .filter((f) => (f.capacity ?? 0) >= filters.minCapacity)
      .map((f) => ({ ...f, distanceKm: haversineKm(origin, f) }))
      .filter((f) => f.distanceKm <= filters.maxDistanceKm);

    switch (filters.sortBy) {
      case "capacity":
        result.sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));
        break;
      case "verified":
        result.sort(
          (a, b) =>
            new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
        );
        break;
      default:
        result.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return result;
  }, [facilities, activeCategory, filters, categoryVisibility, userLocation]);
}
