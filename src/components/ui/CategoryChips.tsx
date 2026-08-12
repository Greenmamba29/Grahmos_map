import {
  Droplets,
  GraduationCap,
  HeartPulse,
  House,
  Zap,
} from 'lucide-react'
import type { FacilityCategory } from '../../types/facilities'

const categoryOptions: Array<{
  id: FacilityCategory
  label: string
  icon: typeof HeartPulse
}> = [
  { id: 'hospital', label: 'Hospitals', icon: HeartPulse },
  { id: 'school', label: 'Schools', icon: GraduationCap },
  { id: 'shelter', label: 'Shelters', icon: House },
  { id: 'water', label: 'Water', icon: Droplets },
  { id: 'power', label: 'Power', icon: Zap },
]

interface CategoryChipsProps {
  active: Set<FacilityCategory>
  onToggle: (category: FacilityCategory) => void
}

export function CategoryChips({ active, onToggle }: CategoryChipsProps) {
  return (
    <div className="category-scroll" aria-label="Facility categories">
      {categoryOptions.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`category-chip ${active.has(id) ? 'active' : ''}`}
          aria-pressed={active.has(id)}
          onClick={() => onToggle(id)}
        >
          <Icon size={17} />
          {label}
        </button>
      ))}
    </div>
  )
}
