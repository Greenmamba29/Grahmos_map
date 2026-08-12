import { useAppStore } from "../../store/appStore";
import { CATEGORIES } from "../../config";
import { Icon } from "../ui/Icon";

/**
 * Horizontal scrollable category chips below the search bar —
 * Hospitals / Schools / Shelters / Water / Power / Comms.
 */
export function CategoryChips() {
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const setFilterSheetOpen = useAppStore((s) => s.setFilterSheetOpen);

  return (
    <div className="pointer-events-auto no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-3">
      <button
        aria-label="Filters"
        onClick={() => setFilterSheetOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium text-ink-soft shadow-[var(--shadow-float)]"
      >
        <Icon name="tune" size={16} />
      </button>
      {CATEGORIES.map((c) => {
        const active = activeCategory === c.id;
        return (
          <button
            key={c.id}
            onClick={() => setActiveCategory(active ? null : c.id)}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium shadow-[var(--shadow-float)] transition-colors ${
              active ? "bg-primary text-white" : "bg-white text-ink"
            }`}
          >
            <Icon
              name={c.icon}
              size={16}
              className={active ? "text-white" : ""}
            />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
