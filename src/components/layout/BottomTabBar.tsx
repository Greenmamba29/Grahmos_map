import type { ReactNode } from 'react'
import {
  Compass,
  Route,
  Bookmark,
  HardDriveDownload,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/geo'

export type AppTab = 'explore' | 'routes' | 'saved' | 'offline' | 'alerts'

const TABS: { id: AppTab; label: string; icon: ReactNode }[] = [
  { id: 'explore', label: 'Explore', icon: <Compass className="h-5 w-5" /> },
  { id: 'routes', label: 'Routes', icon: <Route className="h-5 w-5" /> },
  { id: 'saved', label: 'Saved', icon: <Bookmark className="h-5 w-5" /> },
  {
    id: 'offline',
    label: 'Offline',
    icon: <HardDriveDownload className="h-5 w-5" />,
  },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="h-5 w-5" /> },
]

interface BottomTabBarProps {
  active: AppTab
  onChange: (tab: AppTab) => void
}

export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-20 border-t border-border/80 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                className={cn(
                  'flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
                  isActive ? 'text-primary' : 'text-ink-muted',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
