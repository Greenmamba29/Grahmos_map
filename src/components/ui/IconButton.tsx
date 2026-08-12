import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
};

const iconSizes = {
  sm: 18,
  md: 22,
  lg: 24,
};

export function IconButton({ icon: Icon, label, onClick, className, size = 'md' }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex items-center justify-center rounded-full bg-surface text-text-primary shadow-map-lg transition-colors hover:bg-gray-50 active:bg-gray-100',
        sizeClasses[size],
        className,
      )}
    >
      <Icon size={iconSizes[size]} />
    </button>
  );
}
