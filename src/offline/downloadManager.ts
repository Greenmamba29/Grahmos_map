import type { FacilityCategory, OfflineRegion } from "@/data/types";

/**
 * Rough tile-count-based size estimate for a bounding box + zoom range,
 * mirroring the heuristic used by most offline-map tools: tile count grows
 * ~4x per zoom level, and PMTiles vector tiles for this schema average
 * ~18 KB/tile at typical detail. A production build should instead read
 * the actual PMTiles header (`getHeader()`) for a precise byte count once
 * the archive is generated (see INSTALLATION_GUIDE.md §4).
 */
export function estimateRegionSizeMb(
  bbox: [number, number, number, number],
  minZoom: number,
  maxZoom: number,
  categories: FacilityCategory[],
): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const widthDeg = Math.max(0.01, maxLng - minLng);
  const heightDeg = Math.max(0.01, maxLat - minLat);
  const areaFactor = widthDeg * heightDeg;

  let tileCount = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    tileCount += areaFactor * Math.pow(4, z) * 0.02;
  }

  const avgTileKb = 18;
  const baseMb = (tileCount * avgTileKb) / 1024;
  const categoryFactor = 1 + categories.length * 0.03;
  return Math.max(2, Math.round(baseMb * categoryFactor));
}

export function createQueuedRegion(
  name: string,
  bbox: [number, number, number, number],
  minZoom: number,
  maxZoom: number,
  categories: FacilityCategory[],
): OfflineRegion {
  return {
    id: `region-${Date.now()}`,
    name,
    bbox,
    minZoom,
    maxZoom,
    categories,
    sizeEstimateMb: estimateRegionSizeMb(bbox, minZoom, maxZoom, categories),
    status: "queued",
  };
}
