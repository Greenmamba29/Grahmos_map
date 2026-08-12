import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PillToggleProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  icon?: LucideIcon;
  /** Shows a check mark in place of the icon when active, as Maps filter pills do. */
  showCheck?: boolean;
}

export function PillToggle({
  label,
  active,
  onToggle,
  icon: Icon,
  showCheck = true,
}: PillToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary-soft text-primary-dark'
          : 'border-hairline bg-white text-ink hover:bg-canvas',
      )}
    >
      {active && showCheck ? (
        <Check size={16} strokeWidth={2.5} />
      ) : (
        Icon && <Icon size={16} strokeWidth={2} />
      )}
      {label}
    </button>
  );
}
