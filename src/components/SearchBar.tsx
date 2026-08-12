import { Menu, Mic, Search, WifiOff } from 'lucide-react'

interface SearchBarProps {
  online: boolean
  query: string
  onQueryChange: (query: string) => void
}

export function SearchBar({
  online,
  query,
  onQueryChange,
}: SearchBarProps) {
  return (
    <div className="search-shell">
      <button className="icon-button subtle" aria-label="Open menu" type="button">
        <Menu size={21} strokeWidth={2.2} />
      </button>
      <label className="search-input-wrap">
        <Search className="search-icon" size={19} aria-hidden="true" />
        <span className="sr-only">Search facilities</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search critical facilities"
          autoComplete="off"
          type="search"
        />
      </label>
      {!online && (
        <span className="offline-dot" title="Offline">
          <WifiOff size={14} aria-label="Offline" />
        </span>
      )}
      <button
        className="icon-button subtle voice-button"
        aria-label="Voice search"
        type="button"
      >
        <Mic size={21} strokeWidth={2.2} />
      </button>
    </div>
  )
}
