import type { Hazard } from '@/types';

/**
 * Demonstration hazards near the bundled San Francisco facilities and road
 * network. They intentionally omit expiry times so the offline demo continues
 * to exercise route avoidance without requiring regenerated timestamps.
 */
export const SEED_HAZARDS = [
  {
    id: 'seed-hazard-embarcadero-flood',
    kind: 'flood',
    severity: 4,
    lng: -122.397,
    lat: 37.7902,
    radiusM: 320,
    description: 'Demo coastal flooding affecting lanes near the Embarcadero.',
    reportedAt: '2026-08-16T00:20:00.000Z',
  },
  {
    id: 'seed-hazard-market-blockage',
    kind: 'blocked_road',
    severity: 3,
    lng: -122.4148,
    lat: 37.7794,
    radiusM: 180,
    description: 'Demo debris report; one lane remains passable.',
    reportedAt: '2026-08-15T23:35:00.000Z',
  },
  {
    id: 'seed-hazard-potrero-outage',
    kind: 'outage',
    severity: 2,
    lng: -122.405,
    lat: 37.756,
    radiusM: 700,
    description: 'Demo grid outage with reduced street lighting.',
    reportedAt: '2026-08-15T21:50:00.000Z',
  },
] satisfies Hazard[];
