import { TriangleAlert } from 'lucide-react';
import { OFFLINE_LIMITS } from '@/lib/config';
import { formatBytes } from '@/lib/format';
import { bboxArea, countTiles, estimateBytes, type Bbox } from '@/lib/geo';
import { StorageMeter } from '@/components/offline/StorageMeter';

interface SizeEstimateProps {
  bbox: Bbox | null;
  minZoom: number;
  maxZoom: number;
  facilityCount: number;
  storage: { usage: number; quota: number };
}

/** Live download estimate for the framed area, plus the storage headroom check. */
export function SizeEstimate({
  bbox,
  minZoom,
  maxZoom,
  facilityCount,
  storage,
}: SizeEstimateProps) {
  if (!bbox) {
    return <p className="text-[13px] text-ink-muted">Move the map to size the region.</p>;
  }

  const bytes = estimateBytes(bbox, minZoom, maxZoom, { includeTerrain: true });
  const tiles = countTiles(bbox, minZoom, maxZoom);
  const area = bboxArea(bbox);
  const headroom = storage.quota > 0 ? storage.quota * (1 - OFFLINE_LIMITS.quotaHeadroom) - storage.usage : Infinity;
  const overQuota = bytes > headroom;
  const overArea = area > OFFLINE_LIMITS.maxAreaKm2;

  return (
    <div className="space-y-3 rounded-2xl bg-canvas px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium text-ink">Estimated download</span>
        <span className="text-[17px] font-semibold text-primary">{formatBytes(bytes)}</span>
      </div>

      <p className="text-[12.5px] leading-snug text-ink-muted">
        {Math.round(area).toLocaleString()} km² · {tiles.toLocaleString()} tiles · zoom {minZoom}–
        {maxZoom} · {facilityCount} facilities
      </p>

      <StorageMeter usage={storage.usage} quota={storage.quota} />

      {(overQuota || overArea) && (
        <p className="flex items-start gap-2 text-[12.5px] leading-snug text-critical">
          <TriangleAlert size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          {overArea
            ? `Keep regions under ${OFFLINE_LIMITS.maxAreaKm2.toLocaleString()} km² so a download finishes on a weak connection.`
            : 'This region would not fit in the storage this browser allows.'}
        </p>
      )}
    </div>
  );
}
