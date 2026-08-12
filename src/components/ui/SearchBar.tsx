import { Menu, Mic, Search, SlidersHorizontal, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onFilter: () => void
}

export function SearchBar({ value, onChange, onFilter }: SearchBarProps) {
  return (
    <div className="search-shell">
      <button className="search-leading" type="button" aria-label="Open menu">
        {value ? <Search size={21} /> : <Menu size={22} />}
      </button>
      <label className="search-field">
        <span className="sr-only">Search critical facilities</span>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search critical facilities"
        />
      </label>
      {value && (
        <button
          className="search-action"
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X size={19} />
        </button>
      )}
      <button className="search-action" type="button" aria-label="Voice search">
        <Mic size={20} />
      </button>
      <button className="search-action filter-action" type="button" aria-label="Open filters" onClick={onFilter}>
        <SlidersHorizontal size={19} />
      </button>
    </div>
  )
}
