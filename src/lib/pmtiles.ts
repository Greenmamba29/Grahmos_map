import { addProtocol } from 'maplibre-gl';
import { PMTiles, Protocol } from 'pmtiles';
import { config } from '@/lib/config';
import type { Bbox } from '@/lib/geo';

/**
 * PMTiles integration.
 *
 * A PMTiles archive is a single file read over HTTP range requests, so there is no
 * tile server to keep alive during an outage — and the same byte ranges the map
 * requests are what the service worker caches for offline use.
 */

let protocol: Protocol | null = null;

export function registerPmtilesProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol({ metadata: true });
    addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

const archives = new Map<string, PMTiles>();

export function getArchive(url: string): PMTiles {
  let archive = archives.get(url);
  if (!archive) {
    archive = new PMTiles(url);
    archives.set(url, archive);
    registerPmtilesProtocol().add(archive);
  }
  return archive;
}

export interface ArchiveInfo {
  available: boolean;
  minZoom: number;
  maxZoom: number;
  bounds?: Bbox;
  tileType?: number;
  error?: string;
}

/**
 * Probe an archive before the map tries to use it, so a missing file becomes a
 * clean fallback to the raster basemap rather than a wall of console errors.
 */
export async function probeArchive(url: string): Promise<ArchiveInfo> {
  if (!url) return { available: false, minZoom: 0, maxZoom: 0, error: 'No archive URL configured' };
  try {
    const header = await getArchive(url).getHeader();
    return {
      available: true,
      minZoom: header.minZoom,
      maxZoom: header.maxZoom,
      bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
      tileType: header.tileType,
    };
  } catch (error) {
    return {
      available: false,
      minZoom: 0,
      maxZoom: 0,
      error: error instanceof Error ? error.message : 'Archive unreachable',
    };
  }
}

export async function basemapAvailability(): Promise<{ basemap: ArchiveInfo; terrain: ArchiveInfo }> {
  const [basemap, terrain] = await Promise.all([
    probeArchive(config.basemapPmtilesUrl),
    probeArchive(config.terrainPmtilesUrl),
  ]);
  return { basemap, terrain };
}

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

export interface DownloadProgress {
  fetched: number;
  total: number;
  bytes: number;
}

export interface DownloadOptions {
  bbox: Bbox;
  minZoom: number;
  maxZoom: number;
  /** Hard ceiling on requests so a wide bbox cannot stall the device. */
  maxTiles?: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Warm the tile cache for a bounding box by walking the archive's byte ranges.
 *
 * Each `getZxy` triggers the same range request the map would make, so the
 * service worker's CacheFirst rule stores it and the region is then usable with
 * the network fully down.
 */
export async function downloadRegionTiles(
  url: string,
  options: DownloadOptions,
): Promise<DownloadProgress> {
  const { bbox, minZoom, maxZoom, maxTiles = 6000, onProgress, signal } = options;
  const archive = getArchive(url);
  const header = await archive.getHeader();

  const zoomFloor = Math.max(minZoom, header.minZoom);
  const zoomCeil = Math.min(maxZoom, header.maxZoom);

  const targets: Array<[number, number, number]> = [];
  for (let z = zoomFloor; z <= zoomCeil; z += 1) {
    const x0 = lngToTileX(bbox[0], z);
    const x1 = lngToTileX(bbox[2], z);
    const y0 = latToTileY(bbox[3], z);
    const y1 = latToTileY(bbox[1], z);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
        targets.push([z, x, y]);
      }
    }
  }

  // Coarse zooms first: a partially downloaded region should still render.
  targets.sort((a, b) => a[0] - b[0]);
  const capped = targets.slice(0, maxTiles);

  const progress: DownloadProgress = { fetched: 0, total: capped.length, bytes: 0 };
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < capped.length) {
      if (signal?.aborted) return;
      const index = cursor;
      cursor += 1;
      const [z, x, y] = capped[index];
      try {
        const tile = await archive.getZxy(z, x, y, signal ?? undefined);
        progress.bytes += tile?.data.byteLength ?? 0;
      } catch {
        // Missing tiles are normal at the edges of an archive; keep going.
      }
      progress.fetched += 1;
      if (progress.fetched % 25 === 0 || progress.fetched === capped.length) {
        onProgress?.({ ...progress });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  onProgress?.({ ...progress });
  return progress;
}

/** Drop every cached tile byte range for a removed region. */
export async function purgeTileCache(): Promise<void> {
  if (!('caches' in window)) return;
  await Promise.all(
    ['resilience-tiles', 'resilience-raster-tiles'].map((name) => caches.delete(name)),
  );
}
