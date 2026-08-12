import type { Facility } from "@/data/types";

export type TravelMode = "walk" | "drive" | "4x4" | "terrain";

export interface RouteStep {
  instruction: string;
  distanceM: number;
}

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
}

const EARTH_RADIUS_M = 6371000;

export function haversineDistanceM(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

const MODE_SPEED_KMH: Record<TravelMode, number> = {
  walk: 4.5,
  drive: 38,
  "4x4": 22,
  terrain: 3,
};

export function estimateEtaMinutes(distanceM: number, mode: TravelMode): number {
  const km = distanceM / 1000;
  const hours = km / MODE_SPEED_KMH[mode];
  return Math.max(2, Math.round(hours * 60));
}

/**
 * Synthesizes a plausible turn-by-turn list + elevation profile for a
 * straight-line route to a facility. Deterministic per facility id so the
 * UI is stable across renders. A production build would source both from a
 * terrain-aware routing engine (e.g. Valhalla/OSRM with a DEM cost model)
 * fed by the same PMTiles terrain archive described in
 * INSTALLATION_GUIDE.md §4.
 */
export function synthesizeRoute(
  origin: [number, number],
  facility: Facility,
): { steps: RouteStep[]; elevation: ElevationPoint[]; hazard: boolean } {
  const distanceM = haversineDistanceM(origin, [facility.lng, facility.lat]);
  const seed = facility.id
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const streetNames = [
    "Market St",
    "Mission St",
    "Valencia St",
    "Van Ness Ave",
    "Geary Blvd",
    "3rd St",
    "Divisadero St",
  ];

  const stepCount = 3 + (seed % 3);
  const steps: RouteStep[] = Array.from({ length: stepCount }, (_, i) => {
    const isLast = i === stepCount - 1;
    const street = streetNames[(seed + i) % streetNames.length];
    const verb = i === 0 ? "Head toward" : i % 2 === 0 ? "Turn right onto" : "Turn left onto";
    return {
      instruction: isLast ? `Arrive at ${facility.name}` : `${verb} ${street}`,
      distanceM: isLast ? 0 : Math.round(distanceM / stepCount),
    };
  });

  const elevationPoints = 24;
  const totalKm = distanceM / 1000;
  const baseElevation = 20 + (seed % 40);
  const elevation: ElevationPoint[] = Array.from({ length: elevationPoints }, (_, i) => {
    const t = i / (elevationPoints - 1);
    const wave =
      Math.sin(t * Math.PI * 2 + seed) * 18 + Math.sin(t * Math.PI * 5) * 6;
    return {
      distanceKm: Number((t * totalKm).toFixed(2)),
      elevationM: Math.max(0, Math.round(baseElevation + wave)),
    };
  });

  const hazard = seed % 4 === 0;

  return { steps, elevation, hazard };
}
