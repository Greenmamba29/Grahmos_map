import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface FABProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
}

export function FAB({ icon: Icon, label, onClick, className }: FABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-map-lg transition-colors hover:bg-primary-hover active:scale-95',
        className,
      )}
    >
      <Icon size={24} />
    </button>
  );
}
