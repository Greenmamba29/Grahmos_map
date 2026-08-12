import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, Search, WifiOff, X } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { searchFacilities } from '@/lib/facilities';
import { formatDistance, formatRelativeTime } from '@/lib/format';
import { categoryMeta, STATUS_META } from '@/lib/taxonomy';
import type { Facility } from '@/types';

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  facilities: Facility[];
  online: boolean;
  onSelect: (facility: Facility) => void;
}

/**
 * Search runs against the in-memory facility list, which is itself loaded from the
 * network, the IndexedDB snapshot, or the bundled seed. That means search keeps
 * working with no connectivity — the one thing a responder cannot afford to lose.
 */
export function SearchSheet({ open, onClose, facilities, online, onSelect }: SearchSheetProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // The parent remounts this sheet per open, so the field starts empty without an
  // effect that resets state.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  const results = useMemo(() => {
    if (query.trim().length === 0) {
      return [...facilities]
        .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
        .slice(0, 12);
    }
    return searchFacilities(facilities, query);
  }, [facilities, query]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Search"
      snap="full"
      snapPoints={['full']}
      showScrim={false}
    >
      <div className="sticky top-0 z-10 bg-white px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-full bg-canvas px-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="tap-target grid h-9 w-9 place-items-center rounded-full text-ink-muted"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search facilities or places"
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-ink outline-none"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="tap-target grid h-9 w-9 place-items-center rounded-full text-ink-muted"
            >
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>

        {!online && (
          <p className="mt-2 flex items-center gap-1.5 px-2 text-[12px] text-ink-muted">
            <WifiOff size={13} strokeWidth={2} />
            Searching the copy stored on this device.
          </p>
        )}
      </div>

      <ul className="pb-4">
        {query.trim().length === 0 && (
          <li className="px-4 pb-1 pt-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Nearest facilities
          </li>
        )}

        {results.length === 0 && (
          <li className="px-4 py-10 text-center text-[14px] text-ink-muted">
            <Search size={22} strokeWidth={2} className="mx-auto mb-2 opacity-60" />
            No facility matches “{query}”.
          </li>
        )}

        {results.map((facility) => {
          const meta = categoryMeta(facility.category);
          const status = STATUS_META[facility.status];
          const Icon = meta.icon;
          return (
            <li key={facility.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(facility);
                  onClose();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundColor: meta.color }}
                >
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">
                    {facility.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                    <span style={{ color: status.color }}>{status.label}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDistance(facility.distanceM)}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1 truncate">
                      <Clock size={11} strokeWidth={2} />
                      {formatRelativeTime(facility.verifiedAt ?? facility.lastUpdated)}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
