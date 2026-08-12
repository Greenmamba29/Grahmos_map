import { cn } from '@/lib/cn';
import { CATEGORIES } from '@/lib/taxonomy';
import { useFilters } from '@/state/filters';
import type { FacilityCategory } from '@/types';

interface CategoryChipsProps {
  counts: Partial<Record<FacilityCategory, number>>;
}

/**
 * Horizontal category scroller. Selecting none means "show everything", which
 * matches how the Maps category row behaves and avoids an empty map on first run.
 */
export function CategoryChips({ counts }: CategoryChipsProps) {
  const categories = useFilters((state) => state.categories);
  const toggleCategory = useFilters((state) => state.toggleCategory);
  const setCategories = useFilters((state) => state.setCategories);

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5">
      <button
        type="button"
        onClick={() => setCategories([])}
        aria-pressed={categories.length === 0}
        className={cn(
          'shrink-0 rounded-full px-3.5 py-2 text-[14px] font-medium shadow-[var(--shadow-pill)] transition-colors',
          categories.length === 0 ? 'bg-primary text-white' : 'bg-white text-ink',
        )}
      >
        All
      </button>

      {CATEGORIES.map((meta) => {
        const active = categories.includes(meta.id);
        const Icon = meta.icon;
        const count = counts[meta.id] ?? 0;
        return (
          <button
            key={meta.id}
            type="button"
            onClick={() => toggleCategory(meta.id)}
            aria-pressed={active}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium shadow-[var(--shadow-pill)] transition-colors',
              active ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-canvas',
            )}
          >
            <Icon
              size={16}
              strokeWidth={2.2}
              style={{ color: active ? '#ffffff' : meta.color }}
            />
            {meta.chipLabel}
            <span className={cn('text-[12px]', active ? 'text-white/80' : 'text-ink-muted')}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
