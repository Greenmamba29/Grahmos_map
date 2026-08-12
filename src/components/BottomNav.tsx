import {
  Bell,
  Bookmark,
  Compass,
  Download,
  Route,
  type LucideIcon,
} from 'lucide-react'

const items: { label: string; icon: LucideIcon; badge?: number }[] = [
  { label: 'Explore', icon: Compass },
  { label: 'Routes', icon: Route },
  { label: 'Saved', icon: Bookmark },
  { label: 'Offline', icon: Download },
  { label: 'Alerts', icon: Bell, badge: 2 },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(({ label, icon: Icon, badge }) => (
        <button
          key={label}
          type="button"
          className={label === 'Explore' ? 'active' : ''}
          aria-current={label === 'Explore' ? 'page' : undefined}
        >
          <span className="nav-icon">
            <Icon size={21} strokeWidth={2.2} />
            {badge && <span className="nav-badge">{badge}</span>}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
