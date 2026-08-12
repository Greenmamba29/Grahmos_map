import { Car, Footprints, Ship, Truck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import type { TravelMode } from '@/types';

interface TravelModeTabsProps {
  mode: TravelMode;
  onChange: (mode: TravelMode) => void;
  /** Per-mode duration estimates shown under each icon, when known. */
  estimates?: Partial<Record<TravelMode, number>>;
}

const MODES: Array<{ id: TravelMode; label: string; icon: typeof Car }> = [
  { id: 'drive', label: 'Drive', icon: Car },
  { id: 'truck', label: 'Truck', icon: Truck },
  { id: 'foot', label: 'Walk', icon: Footprints },
  { id: 'boat', label: 'Boat', icon: Ship },
];

export function TravelModeTabs({ mode, onChange, estimates = {} }: TravelModeTabsProps) {
  return (
    <div role="tablist" aria-label="Travel mode" className="flex gap-1">
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = id === mode;
        const estimate = estimates[id];
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 transition-colors',
              active ? 'bg-primary-soft text-primary-dark' : 'text-ink-muted hover:bg-canvas',
            )}
          >
            <Icon size={20} strokeWidth={2.2} />
            <span className="text-[12px] font-medium">
              {estimate !== undefined ? formatDuration(estimate) : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
