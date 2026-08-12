import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { MapCanvas } from '@/components/map/MapCanvas';
import { useMap } from '@/components/map/MapContext';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SizeEstimate } from '@/components/offline/SizeEstimate';
import { OFFLINE_LIMITS } from '@/lib/config';
import { bboxArea, type Bbox } from '@/lib/geo';
import type { Facility } from '@/types';

interface RegionPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (region: { name: string; bbox: Bbox; minZoom: number; maxZoom: number }) => void;
  facilities: Facility[];
  storage: { usage: number; quota: number };
}

type Detail = 'overview' | 'standard' | 'detailed';

const DETAIL_ZOOM: Record<Detail, number> = {
  overview: 11,
  standard: 13,
  detailed: OFFLINE_LIMITS.maxZoom,
};

/**
 * Bounding-box selector.
 *
 * The box is a fixed viewfinder inset from the viewport and the responder frames it
 * by panning and zooming the map. That is deliberate: dragging corner handles is
 * fiddly on a phone in the field, whereas "move the map until the area you need is
 * inside the frame" needs no precision.
 */
export function RegionPicker({
  open,
  onClose,
  onConfirm,
  facilities,
  storage,
}: RegionPickerProps) {
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [detail, setDetail] = useState<Detail>('standard');
  const [name, setName] = useState('');

  const maxZoom = DETAIL_ZOOM[detail];
  const facilityCount = useMemo(() => {
    if (!bbox) return 0;
    return facilities.filter(
      (facility) =>
        facility.lng >= bbox[0] &&
        facility.lng <= bbox[2] &&
        facility.lat >= bbox[1] &&
        facility.lat <= bbox[3],
    ).length;
  }, [bbox, facilities]);

  const tooLarge = bbox ? bboxArea(bbox) > OFFLINE_LIMITS.maxAreaKm2 : false;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="relative min-h-0 flex-1">
        <MapCanvas>
          <ViewfinderTracker onChange={setBbox} />
        </MapCanvas>

        {/* Viewfinder frame: inset 10% horizontally, 14% vertically. */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-[10%] inset-y-[14%] rounded-2xl border-2 border-primary shadow-[0_0_0_9999px_rgba(32,33,36,0.28)]" />
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3 pt-safe">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel region selection"
            className="tap-target grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-map)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
          <p className="rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-ink shadow-[var(--shadow-map)]">
            Pan and zoom to frame the area
          </p>
        </div>
      </div>

      <div className="shrink-0 space-y-4 border-t border-hairline px-4 py-4 pb-safe">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Region name (e.g. Port-au-Prince metro)"
          className="w-full rounded-2xl border border-hairline px-4 py-3 text-[15px] text-ink outline-none focus:border-primary"
        />

        <div>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Detail level
          </h3>
          <SegmentedControl
            label="Detail level"
            size="sm"
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'standard', label: 'Standard' },
              { value: 'detailed', label: 'Detailed' },
            ]}
            value={detail}
            onChange={setDetail}
          />
        </div>

        <SizeEstimate
          bbox={bbox}
          minZoom={OFFLINE_LIMITS.minZoom}
          maxZoom={maxZoom}
          facilityCount={facilityCount}
          storage={storage}
        />

        <button
          type="button"
          disabled={!bbox || tooLarge}
          onClick={() => {
            if (!bbox) return;
            onConfirm({
              name: name.trim() || defaultName(bbox),
              bbox,
              minZoom: OFFLINE_LIMITS.minZoom,
              maxZoom,
            });
            setName('');
            onClose();
          }}
          className="w-full rounded-full bg-primary py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {tooLarge ? 'Area too large — zoom in' : 'Download region'}
        </button>
      </div>
    </div>
  );
}

/** Reports the framed bbox whenever the camera settles. */
function ViewfinderTracker({ onChange }: { onChange: (bbox: Bbox) => void }) {
  const { map, ready } = useMap();

  const compute = useCallback(() => {
    if (!map) return;
    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const insetX = (east - west) * 0.1;
    const insetY = (north - south) * 0.14;
    onChange([west + insetX, south + insetY, east - insetX, north - insetY]);
  }, [map, onChange]);

  useEffect(() => {
    if (!map || !ready) return;
    compute();
    map.on('move', compute);
    return () => {
      map.off('move', compute);
    };
  }, [map, ready, compute]);

  return null;
}

function defaultName(bbox: Bbox): string {
  const lat = ((bbox[1] + bbox[3]) / 2).toFixed(2);
  const lng = ((bbox[0] + bbox[2]) / 2).toFixed(2);
  return `Region ${lat}, ${lng}`;
}
