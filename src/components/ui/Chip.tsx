import { cn } from '@/lib/utils';

interface ChipProps {
  label: string;
  icon?: string;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ label, icon, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-white shadow-map'
          : 'bg-surface text-text-primary shadow-map hover:bg-gray-50',
      )}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {label}
    </button>
  );
}
