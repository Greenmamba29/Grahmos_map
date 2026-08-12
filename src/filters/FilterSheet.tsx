import { BottomSheet } from "@/ui/BottomSheet";
import { PillToggleGroup } from "@/ui/PillToggleGroup";
import { RangeSlider } from "@/ui/Slider";
import { Button } from "@/ui/Button";
import { CATEGORY_META, STATUS_META, type FacilityCategory, type FacilityStatus } from "@/data/types";
import { useFilterStore } from "@/store/useFilterStore";
import { SortSegmentedControl } from "./SortSegmentedControl";

const CATEGORY_OPTIONS: { value: FacilityCategory; label: string; color: string }[] =
  (Object.keys(CATEGORY_META) as FacilityCategory[]).map((c) => ({
    value: c,
    label: CATEGORY_META[c].label,
    color: CATEGORY_META[c].color,
  }));

const STATUS_OPTIONS: { value: FacilityStatus; label: string; color: string }[] =
  (Object.keys(STATUS_META) as FacilityStatus[]).map((s) => ({
    value: s,
    label: STATUS_META[s].label,
    color: STATUS_META[s].color,
  }));

export function FilterSheet() {
  const isOpen = useFilterStore((s) => s.isFilterSheetOpen);
  const closeFilterSheet = useFilterStore((s) => s.closeFilterSheet);
  const activeCategories = useFilterStore((s) => s.activeCategories);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);
  const activeStatuses = useFilterStore((s) => s.activeStatuses);
  const toggleStatus = useFilterStore((s) => s.toggleStatus);
  const capacityRange = useFilterStore((s) => s.capacityRange);
  const setCapacityRange = useFilterStore((s) => s.setCapacityRange);
  const distanceRangeKm = useFilterStore((s) => s.distanceRangeKm);
  const setDistanceRangeKm = useFilterStore((s) => s.setDistanceRangeKm);
  const reset = useFilterStore((s) => s.reset);

  return (
    <BottomSheet open={isOpen} onClose={closeFilterSheet} title="Filters">
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Sort by
          </h3>
          <SortSegmentedControl />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Status
          </h3>
          <PillToggleGroup options={STATUS_OPTIONS} selected={activeStatuses} onToggle={toggleStatus} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Category
          </h3>
          <PillToggleGroup options={CATEGORY_OPTIONS} selected={activeCategories} onToggle={toggleCategory} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Capacity
          </h3>
          <RangeSlider
            min={0}
            max={2000}
            step={50}
            value={capacityRange}
            onChange={setCapacityRange}
            formatValue={(v) => (v >= 2000 ? "2000+" : String(v))}
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Distance (km)
          </h3>
          <RangeSlider
            min={0}
            max={50}
            step={1}
            value={distanceRangeKm}
            onChange={setDistanceRangeKm}
            formatValue={(v) => (v >= 50 ? "50+ km" : `${v} km`)}
          />
        </section>

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={reset} className="flex-1">
            Reset
          </Button>
          <Button variant="primary" onClick={closeFilterSheet} className="flex-1">
            Apply
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
