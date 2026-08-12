import type { Hazard } from '@/types';

export type Bbox = [number, number, number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

/** Great-circle distance in metres. */
export function haversineM(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const y = Math.sin((lng2 - lng1) * DEG) * Math.cos(lat2 * DEG);
  const x =
    Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
    Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lng2 - lng1) * DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

export function compassPoint(deg: number): string {
  const points = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return points[Math.round(deg / 45) % 8];
}

/** Turn direction between two consecutive bearings. */
export function turnFromBearings(prev: number, next: number): 'left' | 'right' | 'straight' {
  const delta = ((next - prev + 540) % 360) - 180;
  if (delta > 25) return 'right';
  if (delta < -25) return 'left';
  return 'straight';
}

export function bboxFromCenter(center: [number, number], widthKm: number, heightKm: number): Bbox {
  const [lng, lat] = center;
  const dLat = heightKm / 111.32 / 2;
  const dLng = widthKm / (111.32 * Math.max(0.05, Math.cos(lat * DEG))) / 2;
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

export function bboxArea(bbox: Bbox): number {
  const [west, south, east, north] = bbox;
  const midLat = (south + north) / 2;
  const widthKm = Math.abs(east - west) * 111.32 * Math.cos(midLat * DEG);
  const heightKm = Math.abs(north - south) * 111.32;
  return Math.max(0, widthKm * heightKm);
}

export function bboxCenter(bbox: Bbox): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

export function bboxContains(bbox: Bbox, point: [number, number]): boolean {
  const [west, south, east, north] = bbox;
  return point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north;
}

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number): number {
  const rad = lat * DEG;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** Number of XYZ tiles covering a bbox across an inclusive zoom range. */
export function countTiles(bbox: Bbox, minZoom: number, maxZoom: number): number {
  const [west, south, east, north] = bbox;
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const x0 = lngToTileX(west, z);
    const x1 = lngToTileX(east, z);
    const y0 = latToTileY(north, z);
    const y1 = latToTileY(south, z);
    total += (Math.abs(x1 - x0) + 1) * (Math.abs(y1 - y0) + 1);
  }
  return total;
}

/**
 * Rough download size for a bbox. Vector tiles in an OpenMapTiles-style archive
 * average 10–40 KB; dense low zooms weigh more per tile than sparse high zooms.
 */
export function estimateBytes(
  bbox: Bbox,
  minZoom: number,
  maxZoom: number,
  opts: { includeTerrain?: boolean } = {},
): number {
  const vectorTiles = countTiles(bbox, minZoom, maxZoom);
  const vectorBytes = vectorTiles * 22_000;
  const terrainBytes = opts.includeTerrain
    ? countTiles(bbox, Math.max(minZoom, 6), Math.min(maxZoom, 12)) * 48_000
    : 0;
  // Facility snapshot + hazard polygons + route graph for the region.
  const dataBytes = Math.max(64_000, bboxArea(bbox) * 900);
  return Math.round(vectorBytes + terrainBytes + dataBytes);
}

export function hazardAffects(point: [number, number], hazard: Hazard): boolean {
  return haversineM(point, [hazard.lng, hazard.lat]) <= hazard.radiusM;
}

export function isHazardActive(hazard: Hazard, now = Date.now()): boolean {
  if (!hazard.expiresAt) return true;
  return new Date(hazard.expiresAt).getTime() > now;
}

/**
 * Deterministic synthetic terrain, used for elevation profiles when no DEM
 * archive is loaded. Smooth, repeatable, and plausible for coastal-hill terrain.
 */
export function syntheticElevationM(lng: number, lat: number): number {
  const x = lng * 180;
  const y = lat * 180;
  const ridge = Math.sin(x * 0.7) * Math.cos(y * 0.55);
  const hills = Math.sin(x * 2.3 + 1.2) * Math.sin(y * 1.9 - 0.4);
  const fine = Math.sin(x * 6.1) * Math.cos(y * 5.3);
  const base = 120 + ridge * 260 + hills * 90 + fine * 18;
  return Math.max(0, Math.round(base));
}
