import clsx from 'clsx';

import { categoryChips } from '../data/categories';
import type { FacilityCategory } from '../types';

type CategoryChipsProps = {
  activeCategories: FacilityCategory[];
  onToggleCategory: (category: FacilityCategory) => void;
};

export function CategoryChips({ activeCategories, onToggleCategory }: CategoryChipsProps) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-1 py-1" aria-label="Facility categories">
      {categoryChips.map((category) => {
        const Icon = category.icon;
        const isActive = activeCategories.includes(category.id);

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onToggleCategory(category.id)}
            className={clsx(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition',
              isActive
                ? 'border-blue-200 bg-blue-50 text-[#1A73E8]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" style={{ color: category.accent }} />
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
