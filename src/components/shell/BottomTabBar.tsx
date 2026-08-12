import { NavLink } from 'react-router-dom';
import { Bell, Bookmark, Download, Map, Route } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TabDef {
  to: string;
  label: string;
  icon: typeof Map;
}

const TABS: TabDef[] = [
  { to: '/', label: 'Explore', icon: Map },
  { to: '/routes', label: 'Routes', icon: Route },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/offline', label: 'Offline', icon: Download },
  { to: '/alerts', label: 'Alerts', icon: Bell },
];

interface BottomTabBarProps {
  /** Count badges keyed by route, e.g. queued reports on Alerts. */
  badges?: Partial<Record<string, number>>;
}

export function BottomTabBar({ badges = {} }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-white/95 backdrop-blur-sm pb-safe"
    >
      <ul className="flex">
        {TABS.map(({ to, label, icon: Icon }) => {
          const badge = badges[to] ?? 0;
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                      {badge > 0 && (
                        <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Height reserved for the tab bar, used to pad map controls and sheets. */
export const TAB_BAR_HEIGHT = 56;
