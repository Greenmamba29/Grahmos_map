import { buildNetwork, type RoadClass, type RoadNode } from '@/data/network';
import {
  bearingDeg,
  compassPoint,
  haversineM,
  isHazardActive,
  syntheticElevationM,
  turnFromBearings,
} from '@/lib/geo';
import type { ElevationSample, Hazard, RoutePlan, RouteStep, TravelMode } from '@/types';

/**
 * Offline terrain-aware router.
 *
 * Cost model: `length / speed × terrainPenalty(slope) × hazardPenalty(proximity)`.
 * Hazards of severity >= 4 are hard-excluded rather than penalised, because a
 * responder should never be handed a route through an impassable segment.
 *
 * Implement this same interface against OSRM or Valhalla to swap in a hosted
 * engine; the UI consumes only `RoutePlan`.
 */
export interface RouteProvider {
  route(request: RouteRequest): Promise<RoutePlan>;
}

export interface RouteRequest {
  origin: [number, number];
  destination: [number, number];
  destinationName: string;
  mode: TravelMode;
  hazards: Hazard[];
  /** Optional DEM sampler; falls back to the synthetic terrain model. */
  sampleElevation?: (lng: number, lat: number) => number | null;
}

/** Metres per second by travel mode and road class. */
const SPEEDS: Record<TravelMode, Record<RoadClass, number>> = {
  drive: { primary: 13.9, secondary: 9.7, track: 5.6 },
  truck: { primary: 11.1, secondary: 7.5, track: 3.3 },
  foot: { primary: 1.35, secondary: 1.3, track: 1.15 },
  boat: { primary: 5.5, secondary: 4.5, track: 3.0 },
};

/** Grade above which a mode starts paying a penalty, and how harshly. */
const GRADE_TOLERANCE: Record<TravelMode, { threshold: number; weight: number }> = {
  drive: { threshold: 0.06, weight: 9 },
  truck: { threshold: 0.04, weight: 16 },
  foot: { threshold: 0.12, weight: 4 },
  boat: { threshold: 0.01, weight: 40 },
};

const HAZARD_HARD_EXCLUDE = 4;

function terrainPenalty(mode: TravelMode, rise: number, run: number): number {
  if (run <= 0) return 1;
  const grade = Math.abs(rise) / run;
  const { threshold, weight } = GRADE_TOLERANCE[mode];
  if (grade <= threshold) return 1;
  return 1 + (grade - threshold) * weight;
}

function hazardPenalty(
  point: [number, number],
  hazards: Hazard[],
): { multiplier: number; blocking?: Hazard; touched: Hazard[] } {
  let multiplier = 1;
  let blocking: Hazard | undefined;
  const touched: Hazard[] = [];

  for (const hazard of hazards) {
    const distance = haversineM(point, [hazard.lng, hazard.lat]);
    if (distance > hazard.radiusM * 2) continue;

    if (distance <= hazard.radiusM) {
      touched.push(hazard);
      if (hazard.severity >= HAZARD_HARD_EXCLUDE) {
        blocking = hazard;
        continue;
      }
      multiplier *= 1 + hazard.severity * 0.6;
    } else {
      // Within the buffer ring: mild preference for staying clear.
      multiplier *= 1 + hazard.severity * 0.08;
    }
  }

  return { multiplier, blocking, touched };
}

function nearestNode(target: [number, number]): RoadNode {
  const { nodes } = buildNetwork();
  let best: RoadNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes.values()) {
    const distance = haversineM(target, [node.lng, node.lat]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }
  // The lattice always contains nodes, so this is unreachable in practice.
  if (!best) throw new Error('Road network is empty');
  return best;
}

interface QueueEntry {
  id: string;
  priority: number;
}

/** Small binary heap; the demo graph is only a few thousand nodes. */
class MinHeap {
  private items: QueueEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: QueueEntry): void {
    this.items.push(entry);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): QueueEntry | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) {
          smallest = left;
        }
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) {
          smallest = right;
        }
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

interface EdgeMeta {
  name: string;
  roadClass: RoadClass;
  reportAgeH: number;
}

export function planRoute(request: RouteRequest): RoutePlan {
  const { origin, destination, mode } = request;
  const network = buildNetwork();
  const hazards = request.hazards.filter(isHazardActive);
  const elevationAt = (lng: number, lat: number): number =>
    request.sampleElevation?.(lng, lat) ?? syntheticElevationM(lng, lat);

  const start = nearestNode(origin);
  const goal = nearestNode(destination);

  const gScore = new Map<string, number>([[start.id, 0]]);
  const cameFrom = new Map<string, { node: string; meta: EdgeMeta }>();
  const visited = new Set<string>();
  const open = new MinHeap();
  const heuristic = (node: RoadNode) =>
    haversineM([node.lng, node.lat], [goal.lng, goal.lat]) / SPEEDS[mode].primary;

  open.push({ id: start.id, priority: heuristic(start) });

  const avoided = new Map<string, Hazard>();

  while (open.size > 0) {
    const current = open.pop();
    if (!current) break;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.id === goal.id) break;

    const node = network.nodes.get(current.id)!;
    const baseCost = gScore.get(current.id) ?? Number.POSITIVE_INFINITY;

    for (const edge of network.adjacency.get(current.id) ?? []) {
      const next = network.nodes.get(edge.to);
      if (!next || visited.has(next.id)) continue;

      const length = haversineM([node.lng, node.lat], [next.lng, next.lat]);
      const midpoint: [number, number] = [(node.lng + next.lng) / 2, (node.lat + next.lat) / 2];
      const { multiplier, blocking } = hazardPenalty(midpoint, hazards);

      if (blocking) {
        avoided.set(blocking.id, blocking);
        continue;
      }

      const rise = elevationAt(next.lng, next.lat) - elevationAt(node.lng, node.lat);
      const speed = SPEEDS[mode][edge.roadClass];
      const cost =
        (length / speed) * terrainPenalty(mode, rise, length) * multiplier;
      const tentative = baseCost + cost;

      if (tentative < (gScore.get(next.id) ?? Number.POSITIVE_INFINITY)) {
        gScore.set(next.id, tentative);
        cameFrom.set(next.id, {
          node: current.id,
          meta: { name: edge.name, roadClass: edge.roadClass, reportAgeH: edge.reportAgeH },
        });
        open.push({ id: next.id, priority: tentative + heuristic(next) });
      }
    }
  }

  const path: RoadNode[] = [];
  const metas: EdgeMeta[] = [];
  let cursor: string | undefined = goal.id;
  while (cursor) {
    const node = network.nodes.get(cursor);
    if (node) path.unshift(node);
    const previous: { node: string; meta: EdgeMeta } | undefined = cameFrom.get(cursor);
    if (!previous) break;
    metas.unshift(previous.meta);
    cursor = previous.node;
  }

  if (path.length < 2 || path[0].id !== start.id) {
    return emptyPlan(request, Array.from(avoided.values()));
  }

  return assemblePlan(request, path, metas, hazards, Array.from(avoided.values()), elevationAt);
}

function assemblePlan(
  request: RouteRequest,
  path: RoadNode[],
  metas: EdgeMeta[],
  hazards: Hazard[],
  avoidedHazards: Hazard[],
  elevationAt: (lng: number, lat: number) => number,
): RoutePlan {
  const { origin, destination, destinationName, mode } = request;

  const coordinates: [number, number][] = [
    origin,
    ...path.map((node) => [node.lng, node.lat] as [number, number]),
    destination,
  ];

  const elevation: ElevationSample[] = [];
  const crossed = new Map<string, Hazard>();
  let distanceM = 0;
  let durationS = 0;
  let ascentM = 0;
  let descentM = 0;
  let maxGradePct = 0;
  let staleHours = 0;

  let previousElevation = elevationAt(coordinates[0][0], coordinates[0][1]);
  elevation.push({ distanceM: 0, elevationM: previousElevation });

  for (let i = 1; i < coordinates.length; i += 1) {
    const from = coordinates[i - 1];
    const to = coordinates[i];
    const segment = haversineM(from, to);
    if (segment <= 0) continue;

    const meta = metas[Math.min(metas.length - 1, Math.max(0, i - 2))];
    const roadClass = meta?.roadClass ?? 'secondary';
    const nextElevation = elevationAt(to[0], to[1]);
    const rise = nextElevation - previousElevation;

    distanceM += segment;
    durationS +=
      (segment / SPEEDS[mode][roadClass]) * terrainPenalty(mode, rise, segment);
    if (rise > 0) ascentM += rise;
    else descentM -= rise;
    maxGradePct = Math.max(maxGradePct, (Math.abs(rise) / segment) * 100);
    staleHours = Math.max(staleHours, meta?.reportAgeH ?? 0);

    const { touched } = hazardPenalty(to, hazards);
    for (const hazard of touched) crossed.set(hazard.id, hazard);

    elevation.push({
      distanceM,
      elevationM: nextElevation,
      hazardSeverity: touched.length > 0 ? Math.max(...touched.map((h) => h.severity)) : undefined,
    });
    previousElevation = nextElevation;
  }

  return {
    mode,
    origin,
    destination,
    destinationName,
    distanceM,
    durationS,
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    maxGradePct: Math.round(maxGradePct * 10) / 10,
    coordinates,
    steps: buildSteps(coordinates, metas, hazards, destinationName, mode),
    elevation,
    avoidedHazards,
    crossedHazards: Array.from(crossed.values()),
    staleHours,
  };
}

function buildSteps(
  coordinates: [number, number][],
  metas: EdgeMeta[],
  hazards: Hazard[],
  destinationName: string,
  mode: TravelMode,
): RouteStep[] {
  const steps: RouteStep[] = [];
  let pendingDistance = 0;
  let pendingDuration = 0;
  let previousBearing = bearingDeg(coordinates[0], coordinates[1] ?? coordinates[0]);
  let currentName = metas[0]?.name ?? 'the road';

  const push = (instruction: string, at: [number, number], warning?: string) => {
    steps.push({
      index: steps.length + 1,
      instruction,
      distanceM: Math.round(pendingDistance),
      durationS: Math.round(pendingDuration),
      warning,
      lng: at[0],
      lat: at[1],
    });
    pendingDistance = 0;
    pendingDuration = 0;
  };

  push(
    `Head ${compassPoint(previousBearing)} on ${currentName}`,
    coordinates[0],
  );

  for (let i = 1; i < coordinates.length - 1; i += 1) {
    const meta = metas[Math.min(metas.length - 1, Math.max(0, i - 1))];
    const segment = haversineM(coordinates[i - 1], coordinates[i]);
    pendingDistance += segment;
    pendingDuration += segment / SPEEDS[mode][meta?.roadClass ?? 'secondary'];

    const nextBearing = bearingDeg(coordinates[i], coordinates[i + 1]);
    const turn = turnFromBearings(previousBearing, nextBearing);
    const nameChanged = (meta?.name ?? currentName) !== currentName;

    if (turn !== 'straight' || (nameChanged && pendingDistance > 250)) {
      const roadName = meta?.name ?? currentName;
      const warning = stepWarning(coordinates[i], hazards, meta);
      const instruction =
        turn === 'straight'
          ? `Continue onto ${roadName}`
          : `Turn ${turn} onto ${roadName}`;
      push(instruction, coordinates[i], warning);
      currentName = roadName;
      previousBearing = nextBearing;
    }
  }

  const last = coordinates[coordinates.length - 1];
  const tail = haversineM(coordinates[coordinates.length - 2] ?? last, last);
  pendingDistance += tail;
  pendingDuration += tail / SPEEDS[mode].secondary;
  push(`Arrive at ${destinationName}`, last);

  return steps;
}

function stepWarning(
  at: [number, number],
  hazards: Hazard[],
  meta: EdgeMeta | undefined,
): string | undefined {
  const nearby = hazards
    .filter((hazard) => haversineM(at, [hazard.lng, hazard.lat]) <= hazard.radiusM * 1.5)
    .sort((a, b) => b.severity - a.severity)[0];

  if (nearby) {
    const label: Record<Hazard['kind'], string> = {
      flood: 'Flooding reported nearby',
      landslide: 'Landslide debris reported nearby',
      blocked_road: 'Road partially blocked',
      fire: 'Fire and smoke reported nearby',
      conflict: 'Security restrictions in this area',
      outage: 'No street lighting in this area',
    };
    return label[nearby.kind];
  }
  if (meta?.roadClass === 'track') return 'Unpaved — high clearance recommended';
  if ((meta?.reportAgeH ?? 0) > 48) return 'Conditions unverified for over 48 hours';
  return undefined;
}

function emptyPlan(request: RouteRequest, avoidedHazards: Hazard[]): RoutePlan {
  const { origin, destination, destinationName, mode } = request;
  const straight = haversineM(origin, destination);
  return {
    mode,
    origin,
    destination,
    destinationName,
    distanceM: straight,
    durationS: straight / SPEEDS[mode].secondary,
    ascentM: 0,
    descentM: 0,
    maxGradePct: 0,
    coordinates: [origin, destination],
    steps: [
      {
        index: 1,
        instruction: `No routable path found to ${destinationName}`,
        distanceM: Math.round(straight),
        durationS: 0,
        warning: 'All candidate roads are blocked by active hazards',
        lng: destination[0],
        lat: destination[1],
      },
    ],
    elevation: [],
    avoidedHazards,
    crossedHazards: [],
    staleHours: Number.POSITIVE_INFINITY,
  };
}

export const localRouteProvider: RouteProvider = {
  route: async (request) => planRoute(request),
};
