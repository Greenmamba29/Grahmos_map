import type { ReactNode } from 'react'
import {
  Building2,
  GraduationCap,
  House,
  Droplets,
  Zap,
  Radio,
} from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import type { FacilityCategory } from '@/types/facility'
import { FACILITY_CATEGORIES } from '@/types/facility'

const ICONS: Record<FacilityCategory, ReactNode> = {
  hospital: <Building2 className="h-4 w-4" />,
  school: <GraduationCap className="h-4 w-4" />,
  shelter: <House className="h-4 w-4" />,
  water: <Droplets className="h-4 w-4" />,
  power: <Zap className="h-4 w-4" />,
  comms: <Radio className="h-4 w-4" />,
}

interface CategoryChipsProps {
  active: FacilityCategory[]
  onToggle: (id: FacilityCategory) => void
}

export function CategoryChips({ active, onToggle }: CategoryChipsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="toolbar"
      aria-label="Facility categories"
    >
      {FACILITY_CATEGORIES.map((cat) => {
        const isOn = active.includes(cat.id)
        return (
          <Chip
            key={cat.id}
            active={isOn}
            onClick={() => onToggle(cat.id)}
            leading={
              <span className={isOn ? 'text-white' : ''} style={{ color: isOn ? undefined : cat.color }}>
                {ICONS[cat.id]}
              </span>
            }
          >
            {cat.label}
          </Chip>
        )
      })}
    </div>
  )
}
