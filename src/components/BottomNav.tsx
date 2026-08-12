import clsx from 'clsx';
import { Bell, Compass, DownloadCloud, Route, Star } from 'lucide-react';

const tabs = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'routes', label: 'Routes', icon: Route },
  { id: 'saved', label: 'Saved', icon: Star },
  { id: 'offline', label: 'Offline', icon: DownloadCloud },
  { id: 'alerts', label: 'Alerts', icon: Bell }
] as const;

export function BottomNav() {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="mx-auto flex max-w-screen-sm justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === 'explore';

          return (
            <button
              key={tab.id}
              type="button"
              className={clsx(
                'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold transition',
                active ? 'text-[#1A73E8]' : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              <span
                className={clsx(
                  'rounded-full px-4 py-1',
                  active ? 'bg-blue-50' : 'bg-transparent'
                )}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
