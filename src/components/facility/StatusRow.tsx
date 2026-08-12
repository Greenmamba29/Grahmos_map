import { Clock, MapPin } from 'lucide-react';
import { formatDistance, formatRelativeTime, hoursSince } from '@/lib/format';
import { categoryMeta, STATUS_META } from '@/lib/taxonomy';
import type { Facility } from '@/types';

interface StatusRowProps {
  facility: Facility;
}

/** Status, category and freshness — the row that replaces Maps' star rating. */
export function StatusRow({ facility }: StatusRowProps) {
  const meta = categoryMeta(facility.category);
  const status = STATUS_META[facility.status];
  const age = hoursSince(facility.verifiedAt);
  const stale = age > 24;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium"
          style={{ backgroundColor: status.softColor, color: status.color }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: status.color }}
            aria-hidden
          />
          {status.label}
        </span>
        <span className="text-ink-muted">{meta.label}</span>
        {facility.distanceM !== undefined && (
          <>
            <span className="text-ink-muted" aria-hidden>
              ·
            </span>
            <span className="text-ink-muted">{formatDistance(facility.distanceM)} away</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[13px]" style={{ color: stale ? '#f9ab00' : '#5f6368' }}>
        <Clock size={13} strokeWidth={2} />
        <span>
          {facility.verifiedAt
            ? `Verified ${formatRelativeTime(facility.verifiedAt)}`
            : `Never verified — last edited ${formatRelativeTime(facility.lastUpdated)}`}
        </span>
      </div>

      {facility.address && (
        <div className="flex items-start gap-1.5 text-[13px] text-ink-muted">
          <MapPin size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{facility.address}</span>
        </div>
      )}
    </div>
  );
}
