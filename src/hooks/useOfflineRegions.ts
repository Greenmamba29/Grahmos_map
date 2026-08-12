import { useCallback, useEffect, useRef, useState } from 'react';
import { config, OFFLINE_LIMITS } from '@/lib/config';
import { facilityCache, regionStore, requestPersistentStorage, storageEstimate } from '@/lib/db';
import { loadFacilities } from '@/lib/facilities';
import { bboxArea, bboxCenter, bboxContains, estimateBytes, type Bbox } from '@/lib/geo';
import { downloadRegionTiles, purgeTileCache } from '@/lib/pmtiles';
import type { OfflineRegion } from '@/types';

interface DownloadRequest {
  name: string;
  bbox: Bbox;
  minZoom?: number;
  maxZoom?: number;
  includeTerrain?: boolean;
}

interface OfflineRegionsHook {
  regions: OfflineRegion[];
  storage: { usage: number; quota: number };
  busy: boolean;
  error?: string;
  download: (request: DownloadRequest) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refreshRegion: (id: string) => Promise<void>;
  cancel: () => void;
  reload: () => void;
}

/**
 * Offline region manager.
 *
 * A "download" does three things: walk the PMTiles byte ranges for the bbox so the
 * service worker caches them, snapshot the facilities inside the bbox into
 * IndexedDB, and record the region so the UI can show its size and freshness.
 */
export function useOfflineRegions(): OfflineRegionsHook {
  const [regions, setRegions] = useState<OfflineRegion[]>([]);
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    void regionStore.all().then((stored) => {
      setRegions(
        [...stored].sort(
          (a, b) =>
            new Date(b.downloadedAt ?? 0).getTime() - new Date(a.downloadedAt ?? 0).getTime(),
        ),
      );
    });
    void storageEstimate().then(setStorage);
  }, []);

  useEffect(reload, [reload]);

  const download = useCallback(
    async ({
      name,
      bbox,
      minZoom = OFFLINE_LIMITS.minZoom,
      maxZoom = OFFLINE_LIMITS.maxZoom,
      includeTerrain = true,
    }: DownloadRequest) => {
      setError(undefined);

      const area = bboxArea(bbox);
      if (area > OFFLINE_LIMITS.maxAreaKm2) {
        setError(
          `Region is ${Math.round(area).toLocaleString()} km² — keep it under ${OFFLINE_LIMITS.maxAreaKm2.toLocaleString()} km².`,
        );
        return;
      }

      const estimated = estimateBytes(bbox, minZoom, maxZoom, { includeTerrain });
      const { usage, quota } = await storageEstimate();
      if (quota > 0 && usage + estimated > quota * (1 - OFFLINE_LIMITS.quotaHeadroom)) {
        setError('Not enough free storage on this device for a region that size.');
        return;
      }

      await requestPersistentStorage();

      const id = `region-${Date.now()}`;
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      const record: OfflineRegion = {
        id,
        name,
        bbox,
        minZoom,
        maxZoom,
        sizeBytes: 0,
        facilityCount: 0,
        status: 'downloading',
        progress: 0,
        downloadedAt: new Date().toISOString(),
      };
      await regionStore.put(record);
      reload();

      try {
        let bytes = 0;

        const basemapResult = await downloadRegionTiles(config.basemapPmtilesUrl, {
          bbox,
          minZoom,
          maxZoom,
          signal: controller.signal,
          onProgress: async (progress) => {
            const ratio = progress.total > 0 ? progress.fetched / progress.total : 0;
            await regionStore.put({
              ...record,
              status: 'downloading',
              progress: includeTerrain ? ratio * 0.7 : ratio,
              sizeBytes: bytes + progress.bytes,
            });
            reload();
          },
        });
        bytes += basemapResult.bytes;

        if (includeTerrain && config.terrainPmtilesUrl) {
          try {
            const terrainResult = await downloadRegionTiles(config.terrainPmtilesUrl, {
              bbox,
              minZoom: Math.max(minZoom, 6),
              maxZoom: Math.min(maxZoom, 12),
              signal: controller.signal,
              onProgress: async (progress) => {
                const ratio = progress.total > 0 ? progress.fetched / progress.total : 0;
                await regionStore.put({
                  ...record,
                  status: 'downloading',
                  progress: 0.7 + ratio * 0.25,
                  sizeBytes: bytes + progress.bytes,
                });
                reload();
              },
            });
            bytes += terrainResult.bytes;
          } catch {
            // A missing terrain archive must not fail the whole region.
          }
        }

        const { facilities } = await loadFacilities(bboxCenter(bbox), { radiusM: 60_000 });
        const inRegion = facilities.filter((facility) =>
          bboxContains(bbox, [facility.lng, facility.lat]),
        );
        await facilityCache.put(inRegion);

        // With no archive present the byte total is zero; fall back to the estimate
        // so the card still reports a meaningful size.
        const sizeBytes = bytes > 0 ? bytes : estimated;

        await regionStore.put({
          ...record,
          status: controller.signal.aborted ? 'failed' : 'downloaded',
          error: controller.signal.aborted ? 'Cancelled' : undefined,
          progress: 1,
          sizeBytes,
          facilityCount: inRegion.length,
          downloadedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
        });
      } catch (cause) {
        await regionStore.put({
          ...record,
          status: 'failed',
          error: cause instanceof Error ? cause.message : 'Download failed',
        });
        setError(cause instanceof Error ? cause.message : 'Download failed');
      } finally {
        abortRef.current = null;
        setBusy(false);
        reload();
      }
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await regionStore.remove(id);
      const remaining = await regionStore.all();
      // Tile byte ranges are shared between regions, so only a full purge is safe
      // once nothing is downloaded any more.
      if (remaining.length === 0) await purgeTileCache();
      reload();
    },
    [reload],
  );

  const refreshRegion = useCallback(
    async (id: string) => {
      const existing = (await regionStore.all()).find((region) => region.id === id);
      if (!existing) return;
      await download({
        name: existing.name,
        bbox: existing.bbox,
        minZoom: existing.minZoom,
        maxZoom: existing.maxZoom,
      });
      await regionStore.remove(id);
      reload();
    },
    [download, reload],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { regions, storage, busy, error, download, remove, refreshRegion, cancel, reload };
}
