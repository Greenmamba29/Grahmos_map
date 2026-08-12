import {
  Bell,
  Bookmark,
  Compass,
  MapPinned,
  Route,
} from 'lucide-react'

const items = [
  { label: 'Explore', icon: Compass },
  { label: 'Routes', icon: Route },
  { label: 'Saved', icon: Bookmark },
  { label: 'Offline', icon: MapPinned },
  { label: 'Alerts', icon: Bell },
]

interface BottomNavProps {
  active: string
  onChange: (label: string) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          className={active === label ? 'active' : ''}
          aria-current={active === label ? 'page' : undefined}
          onClick={() => onChange(label)}
        >
          <span><Icon size={21} strokeWidth={active === label ? 2.5 : 2} /></span>
          {label}
        </button>
      ))}
    </nav>
  )
}
