import { Mic, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  onOpenSearch: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  placeholder?: string;
}

/**
 * The floating search pill. Voice input is offered only when the browser exposes
 * speech recognition, since it also needs a network round trip in most engines —
 * during an outage the field falls back to typing against the local index.
 */
export function SearchBar({
  onOpenSearch,
  onOpenFilters,
  activeFilterCount,
  placeholder = 'Search facilities or places',
}: SearchBarProps) {
  const voiceSupported =
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white pl-4 pr-2 shadow-[var(--shadow-map)]">
        <Search size={20} strokeWidth={2} className="shrink-0 text-ink-muted" />
        <button
          type="button"
          onClick={onOpenSearch}
          className="min-w-0 flex-1 truncate py-3 text-left text-[15px] text-ink-muted"
        >
          {placeholder}
        </button>
        {voiceSupported && (
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search by voice"
            className="tap-target grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-canvas"
          >
            <Mic size={19} strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenFilters}
          aria-label={
            activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'
          }
          className={cn(
            'tap-target relative grid h-9 w-9 shrink-0 place-items-center rounded-full',
            activeFilterCount > 0 ? 'text-primary' : 'text-ink-muted hover:bg-canvas',
          )}
        >
          <SlidersHorizontal size={19} strokeWidth={2} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
