import { Compass, Route, Bookmark, Download, Bell } from 'lucide-react';
import { TABS, type TabId } from '@/types/navigation';
import { cn } from '@/lib/utils';

const ICONS = {
  compass: Compass,
  route: Route,
  bookmark: Bookmark,
  download: Download,
  bell: Bell,
} as const;

interface BottomTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="flex shrink-0 items-stretch border-t border-gray-200 bg-surface safe-bottom">
      {TABS.map(({ id, label, icon }) => {
        const Icon = ICONS[icon];
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
              active ? 'text-primary' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
