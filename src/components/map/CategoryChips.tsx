import { useMemo } from 'react';
import { Chip } from '@/components/ui/Chip';
import {
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  type FacilityCategory,
} from '@/types/facility';

const CHIP_CATEGORIES: FacilityCategory[] = [
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
];

interface CategoryChipsProps {
  activeCategories: FacilityCategory[];
  onToggle: (category: FacilityCategory) => void;
}

export function CategoryChips({ activeCategories, onToggle }: CategoryChipsProps) {
  const chips = useMemo(
    () =>
      CHIP_CATEGORIES.map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        icon: CATEGORY_ICONS[cat],
        active: activeCategories.includes(cat),
      })),
    [activeCategories],
  );

  return (
    <div className="pointer-events-auto mt-2 overflow-x-auto px-4 pb-1">
      <div className="flex gap-2">
        {chips.map(({ category, label, icon, active }) => (
          <Chip
            key={category}
            label={label}
            icon={icon}
            active={active}
            onClick={() => onToggle(category)}
          />
        ))}
      </div>
    </div>
  );
}
