import { BadgeCheck, Droplet, Zap, DoorOpen } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PillToggle } from '@/components/ui/PillToggle';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CAPACITY_BOUNDS, DISTANCE_BOUNDS, useFilters } from '@/state/filters';
import type { SortKey } from '@/types';

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  resultCount: number;
}

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'distance', label: 'Distance' },
  { value: 'capacity', label: 'Free capacity' },
  { value: 'updated', label: 'Recently updated' },
];

/**
 * Filter panel. The Maps price slider is repurposed twice here: as a capacity band
 * (how many people or beds a site can still take) and as a distance ceiling, which
 * are the two questions that actually decide where someone gets sent.
 */
export function FilterSheet({ open, onClose, resultCount }: FilterSheetProps) {
  const filters = useFilters();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Filter facilities"
      snap="half"
      snapPoints={['half', 'full']}
    >
      <div className="flex items-center justify-between px-4 pt-1 pb-3">
        <h2 className="text-[17px] font-semibold text-ink">Filters</h2>
        <button
          type="button"
          onClick={filters.reset}
          className="rounded-full px-3 py-1.5 text-[14px] font-medium text-primary hover:bg-primary-soft"
        >
          Reset
        </button>
      </div>

      <div className="space-y-6 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          <PillToggle
            label="Open now"
            icon={DoorOpen}
            active={filters.openNow}
            onToggle={() => filters.togglePill('openNow')}
          />
          <PillToggle
            label="Verified in 24h"
            icon={BadgeCheck}
            active={filters.verifiedRecently}
            onToggle={() => filters.togglePill('verifiedRecently')}
          />
          <PillToggle
            label="Has generator"
            icon={Zap}
            active={filters.hasGenerator}
            onToggle={() => filters.togglePill('hasGenerator')}
          />
          <PillToggle
            label="Has water"
            icon={Droplet}
            active={filters.hasWater}
            onToggle={() => filters.togglePill('hasWater')}
          />
        </div>

        <div>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Sort by
          </h3>
          <SegmentedControl
            label="Sort facilities by"
            options={SORT_OPTIONS}
            value={filters.sortBy}
            onChange={filters.setSortBy}
            size="sm"
          />
        </div>

        <RangeSlider
          label="Capacity"
          min={CAPACITY_BOUNDS[0]}
          max={CAPACITY_BOUNDS[1]}
          step={50}
          value={filters.capacityRange}
          onChange={(value) => filters.setCapacityRange(value as [number, number])}
          formatValue={(value) =>
            value >= CAPACITY_BOUNDS[1] ? `${CAPACITY_BOUNDS[1]}+` : String(value)
          }
        />

        <RangeSlider
          label="Distance"
          min={DISTANCE_BOUNDS[0]}
          max={DISTANCE_BOUNDS[1]}
          step={1}
          value={filters.maxDistanceKm}
          onChange={(value) => filters.setMaxDistanceKm(value as number)}
          formatValue={(value) =>
            value >= DISTANCE_BOUNDS[1] ? 'Any distance' : `within ${value} km`
          }
        />
      </div>

      <div className="sticky bottom-0 border-t border-hairline bg-white px-4 py-3 pb-safe">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full bg-primary py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-dark"
        >
          Show {resultCount} {resultCount === 1 ? 'facility' : 'facilities'}
        </button>
      </div>
    </BottomSheet>
  );
}
