import {
  CircleCheck,
  CircleAlert,
  Clock,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import { bboxArea } from '@/lib/geo';
import type { OfflineRegion, RegionStatus } from '@/types';

interface RegionCardProps {
  region: OfflineRegion;
  onRemove: (id: string) => void;
  onRefresh: (id: string) => void;
  onShowOnMap: (region: OfflineRegion) => void;
}

const STATUS_ICON: Record<RegionStatus, { Icon: typeof CircleCheck; color: string; label: string }> = {
  downloaded: { Icon: CircleCheck, color: '#188038', label: 'Ready offline' },
  downloading: { Icon: LoaderCircle, color: '#1a73e8', label: 'Downloading' },
  queued: { Icon: Clock, color: '#5f6368', label: 'Queued' },
  stale: { Icon: CircleAlert, color: '#f9ab00', label: 'Update available' },
  failed: { Icon: CircleAlert, color: '#d93025', label: 'Failed' },
};

export function RegionCard({ region, onRemove, onRefresh, onShowOnMap }: RegionCardProps) {
  const { Icon, color, label } = STATUS_ICON[region.status];
  const spinning = region.status === 'downloading';

  return (
    <li className="rounded-2xl border border-hairline p-4">
      <div className="flex items-start gap-3">
        <Icon
          size={19}
          strokeWidth={2.2}
          style={{ color }}
          className={spinning ? 'mt-0.5 shrink-0 animate-spin' : 'mt-0.5 shrink-0'}
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onShowOnMap(region)}
            className="block max-w-full truncate text-left text-[15.5px] font-medium text-ink"
          >
            {region.name}
          </button>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {formatBytes(region.sizeBytes)} · {Math.round(bboxArea(region.bbox)).toLocaleString()} km²
            · zoom {region.minZoom}–{region.maxZoom}
          </p>
          <p className="mt-0.5 text-[12.5px]" style={{ color }}>
            {label}
            {region.status === 'downloaded' && region.downloadedAt && (
              <span className="text-ink-muted">
                {' '}
                · saved {formatRelativeTime(region.downloadedAt)} · {region.facilityCount} facilities
              </span>
            )}
            {region.status === 'failed' && region.error && (
              <span className="text-ink-muted"> · {region.error}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onRefresh(region.id)}
            aria-label={`Update ${region.name}`}
            className="tap-target grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-canvas"
          >
            <RefreshCw size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(region.id)}
            aria-label={`Delete ${region.name}`}
            className="tap-target grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-critical-soft hover:text-critical"
          >
            <Trash2 size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {spinning && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.round(region.progress * 100)}%` }}
          />
        </div>
      )}
    </li>
  );
}
