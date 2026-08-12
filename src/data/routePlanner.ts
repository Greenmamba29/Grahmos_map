import type { Facility, RoutePlan, TravelMode } from "../types";
import { haversineKm } from "./facilitiesRepo";

const SPEED_KMH: Record<TravelMode, number> = { walk: 4.6, bike: 14, drive: 32 };

/** Deterministic pseudo-random from a string seed (stable per facility). */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Demo terrain-aware route planner. Without a routing backend it produces a
 * plausible dog-leg route (streets rarely run straight), a synthetic but
 * deterministic elevation profile, and turn-by-turn steps. Swap this module
 * for a Valhalla/OSRM client (self-hosted, offline-capable) in production.
 */
export function planRoute(
  from: { lng: number; lat: number },
  to: Facility,
  mode: TravelMode,
): RoutePlan {
  const rand = seeded(to.id + mode);

  // Manhattan-ish dog-leg with slight jitter.
  const midA: [number, number] = [
    from.lng + (to.lng - from.lng) * 0.45 + (rand() - 0.5) * 0.004,
    from.lat + (to.lat - from.lat) * 0.1 + (rand() - 0.5) * 0.004,
  ];
  const midB: [number, number] = [
    from.lng + (to.lng - from.lng) * 0.55 + (rand() - 0.5) * 0.004,
    from.lat + (to.lat - from.lat) * 0.85 + (rand() - 0.5) * 0.004,
  ];
  const line: [number, number][] = [
    [from.lng, from.lat],
    midA,
    midB,
    [to.lng, to.lat],
  ];

  let distanceKm = 0;
  for (let i = 1; i < line.length; i++) {
    distanceKm += haversineKm(
      { lng: line[i - 1][0], lat: line[i - 1][1] },
      { lng: line[i][0], lat: line[i][1] },
    );
  }
  const distanceM = Math.round(distanceKm * 1000);
  const durationMin = Math.max(1, Math.round((distanceKm / SPEED_KMH[mode]) * 60));

  // Synthetic elevation profile: base + two hills, deterministic per route.
  const samples = 48;
  const base = 8 + rand() * 40;
  const hill1 = { at: 0.25 + rand() * 0.2, h: 20 + rand() * 55, w: 0.12 };
  const hill2 = { at: 0.6 + rand() * 0.25, h: 10 + rand() * 40, w: 0.1 };
  const elevation: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const g = (hill: typeof hill1) =>
      hill.h * Math.exp(-((t - hill.at) ** 2) / (2 * hill.w ** 2));
    elevation.push(Math.round(base + g(hill1) + g(hill2) + (rand() - 0.5) * 3));
  }
  let ascentM = 0;
  let descentM = 0;
  for (let i = 1; i < samples; i++) {
    const d = elevation[i] - elevation[i - 1];
    if (d > 0) ascentM += d;
    else descentM -= d;
  }

  const streets = [
    "Valencia St",
    "Market St",
    "Divisadero St",
    "Fulton St",
    "Cesar Chavez St",
    "Bay St",
  ];
  const s1 = streets[Math.floor(rand() * streets.length)];
  let s2 = streets[Math.floor(rand() * streets.length)];
  if (s2 === s1) s2 = streets[(streets.indexOf(s1) + 1) % streets.length];

  const steps = [
    { instruction: `Head ${to.lat > from.lat ? "north" : "south"} on ${s1}`, distanceM: Math.round(distanceM * 0.3) },
    {
      instruction: `Turn ${rand() > 0.5 ? "left" : "right"} onto ${s2}`,
      distanceM: Math.round(distanceM * 0.4),
      caution: rand() > 0.6 ? "Reported debris on this segment (3 h ago)" : undefined,
    },
    { instruction: `Continue past the ${rand() > 0.5 ? "park" : "plaza"}`, distanceM: Math.round(distanceM * 0.2) },
    { instruction: `Arrive at ${to.name}`, distanceM: Math.round(distanceM * 0.1) },
  ];

  return {
    mode,
    distanceM,
    durationMin,
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    elevation,
    steps,
    line,
    caution:
      "Route may be blocked or unverified — based on map data downloaded before the outage. Verify conditions where possible.",
  };
}
