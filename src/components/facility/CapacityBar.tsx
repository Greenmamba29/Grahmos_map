import { categoryMeta } from '@/lib/taxonomy';
import type { Facility } from '@/types';

interface CapacityBarProps {
  facility: Facility;
}

/** Occupied vs total, coloured by how much headroom is left. */
export function CapacityBar({ facility }: CapacityBarProps) {
  const { capacityUnit } = categoryMeta(facility.category);

  if (facility.capacity === undefined) {
    return (
      <p className="rounded-2xl bg-canvas px-4 py-3 text-[14px] text-ink-muted">
        No capacity figure recorded for this site. Submit a status report to add one.
      </p>
    );
  }

  const total = facility.capacity;
  const occupied = Math.min(total, facility.occupancy ?? 0);
  const free = total - occupied;
  const ratio = total > 0 ? occupied / total : 0;
  const color = ratio >= 0.95 ? '#d93025' : ratio >= 0.8 ? '#f9ab00' : '#188038';

  return (
    <div className="rounded-2xl border border-hairline p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium text-ink">
          {free.toLocaleString()} {capacityUnit} free
        </span>
        <span className="text-[13px] text-ink-muted">
          {occupied.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>

      <div
        className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-canvas"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={occupied}
        aria-label={`Occupancy of ${facility.name}`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: color }}
        />
      </div>

      <p className="mt-2 text-[12.5px]" style={{ color }}>
        {ratio >= 0.95
          ? 'At capacity — redirect new arrivals'
          : ratio >= 0.8
            ? 'Filling up — confirm before sending a group'
            : 'Accepting arrivals'}
      </p>
    </div>
  );
}
