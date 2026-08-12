import { cn } from '@/lib/cn';
import type { BasemapId } from '@/types';

interface MapTypeCardProps {
  id: BasemapId;
  label: string;
  selected: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onSelect: (id: BasemapId) => void;
}

/** Thumbnails are drawn in CSS so no imagery has to be downloaded to pick a basemap. */
const THUMBNAILS: Record<BasemapId, string> = {
  default: 'linear-gradient(135deg,#f8f9fa 0%,#e8f5e9 45%,#aadaff 100%)',
  terrain: 'linear-gradient(135deg,#efe7d8 0%,#c9b99a 40%,#8d9a72 75%,#5f6b4a 100%)',
  satellite: 'linear-gradient(135deg,#2b3a1f 0%,#4b5d2f 40%,#7c6a45 70%,#1b3b52 100%)',
};

export function MapTypeCard({
  id,
  label,
  selected,
  disabled = false,
  disabledHint,
  onSelect,
}: MapTypeCardProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(id)}
      aria-pressed={selected}
      aria-disabled={disabled}
      className={cn('flex flex-col items-center gap-1.5 text-center', disabled && 'opacity-50')}
    >
      <span
        className={cn(
          'h-16 w-full rounded-2xl border-2 transition-colors',
          selected ? 'border-primary' : 'border-transparent',
        )}
        style={{ backgroundImage: THUMBNAILS[id] }}
      />
      <span
        className={cn(
          'text-[13px] font-medium',
          selected ? 'text-primary' : 'text-ink',
        )}
      >
        {label}
      </span>
      {disabled && disabledHint && (
        <span className="text-[11px] leading-tight text-ink-muted">{disabledHint}</span>
      )}
    </button>
  );
}
