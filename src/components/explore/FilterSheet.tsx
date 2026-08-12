import { useEffect, useState } from "react";
import { useAppStore, DEFAULT_FILTERS } from "../../store/appStore";
import { BottomSheet } from "../ui/BottomSheet";
import { Pill } from "../ui/Pill";
import { RangeSlider } from "../ui/RangeSlider";
import { Icon } from "../ui/Icon";
import type { Filters, SortBy } from "../../types";

const TOGGLES: { key: keyof Filters; label: string; icon: string }[] = [
  { key: "openNow", label: "Open now", icon: "clock" },
  { key: "verified24h", label: "Verified < 24 h", icon: "check" },
  { key: "hasPower", label: "Has power", icon: "power" },
  { key: "hasWater", label: "Has water", icon: "water" },
  { key: "accessible", label: "Accessible", icon: "shelter" },
];

const SORTS: { id: SortBy; label: string }[] = [
  { id: "distance", label: "Distance" },
  { id: "capacity", label: "Capacity" },
  { id: "verified", label: "Last verified" },
];

/** Pattern 3 — slide-up filter panel with pills, segmented sort, sliders. */
export function FilterSheet() {
  const open = useAppStore((s) => s.filterSheetOpen);
  const setOpen = useAppStore((s) => s.setFilterSheetOpen);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const [draft, setDraft] = useState<Filters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  return (
    <BottomSheet open={open} onClose={() => setOpen(false)} title="Filter facilities">
      <div className="flex h-full flex-col">
        <div className="grow px-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Requirements
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {TOGGLES.map((t) => (
              <Pill
                key={t.key}
                active={Boolean(draft[t.key])}
                onClick={() =>
                  setDraft({ ...draft, [t.key]: !draft[t.key] })
                }
              >
                <Icon name={t.icon} size={14} />
                {t.label}
              </Pill>
            ))}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Sort by
          </p>
          <div className="mb-6 flex rounded-full border border-line p-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setDraft({ ...draft, sortBy: s.id })}
                aria-pressed={draft.sortBy === s.id}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                  draft.sortBy === s.id
                    ? "bg-primary text-white"
                    : "text-ink-soft"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mb-6 space-y-6">
            <RangeSlider
              label="Distance radius"
              min={0.5}
              max={50}
              step={0.5}
              value={draft.maxDistanceKm}
              onChange={(v) => setDraft({ ...draft, maxDistanceKm: v })}
              format={(v) => `${v} km`}
            />
            <RangeSlider
              label="Minimum capacity"
              min={0}
              max={1500}
              step={50}
              value={draft.minCapacity}
              onChange={(v) => setDraft({ ...draft, minCapacity: v })}
              format={(v) => (v === 0 ? "Any" : `${v}+ people`)}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            className="text-sm font-medium text-primary"
            onClick={() => setDraft(DEFAULT_FILTERS)}
          >
            Clear
          </button>
          <button
            className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
            onClick={() => {
              setFilters(draft);
              setOpen(false);
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
