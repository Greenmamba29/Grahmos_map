import { SquareStack } from 'lucide-react';
import { cn } from '@/lib/cn';

interface LayersButtonProps {
  onClick: () => void;
  active: boolean;
}

/** The circular stacked-square control that floats at the top-right of the map. */
export function LayersButton({ onClick, active }: LayersButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Map layers"
      aria-pressed={active}
      className={cn(
        'tap-target grid h-10 w-10 place-items-center rounded-full bg-white shadow-[var(--shadow-map)] transition-colors',
        active ? 'text-primary' : 'text-ink-muted hover:text-ink',
      )}
    >
      <SquareStack size={20} strokeWidth={2} />
    </button>
  );
}
