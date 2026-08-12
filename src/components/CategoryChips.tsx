import {
  Droplets,
  GraduationCap,
  Hospital,
  SlidersHorizontal,
  TentTree,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import {
  categoryLabels,
  facilityCategories,
  type FacilityCategory,
} from '../types/map'

const icons: Record<FacilityCategory, LucideIcon> = {
  hospital: Hospital,
  school: GraduationCap,
  shelter: TentTree,
  water: Droplets,
  power: Zap,
}

interface CategoryChipsProps {
  selected: Set<FacilityCategory>
  onToggle: (category: FacilityCategory) => void
}

export function CategoryChips({ selected, onToggle }: CategoryChipsProps) {
  return (
    <div className="category-scroller" aria-label="Facility filters">
      <button className="filter-chip filter-only" type="button">
        <SlidersHorizontal size={17} />
        <span className="sr-only">More filters</span>
      </button>
      {facilityCategories.map((category) => {
        const Icon = icons[category]
        const active = selected.has(category)
        return (
          <button
            className={clsx('filter-chip', active && 'active')}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(category)}
            key={category}
          >
            <Icon size={17} strokeWidth={2.3} />
            {categoryLabels[category]}
          </button>
        )
      })}
    </div>
  )
}
