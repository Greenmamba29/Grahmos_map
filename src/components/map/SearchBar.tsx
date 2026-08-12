import { Search, Mic } from 'lucide-react';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
}

export function SearchBar({
  value = '',
  onChange,
  onFocus,
  placeholder = 'Search facilities, shelters, water…',
}: SearchBarProps) {
  return (
    <div className="pointer-events-auto mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 shadow-map-lg">
      <Search size={20} className="shrink-0 text-text-secondary" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
      />
      <button
        type="button"
        aria-label="Voice search"
        className="shrink-0 rounded-full p-1 text-text-secondary transition-colors hover:bg-gray-100 hover:text-primary"
      >
        <Mic size={20} />
      </button>
    </div>
  );
}
