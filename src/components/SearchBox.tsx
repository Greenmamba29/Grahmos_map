import { useMemo, useState } from 'react'
import { ArrowLeft, MapPin, Radio, Search, X } from 'lucide-react'
import { searchPlaces, type Place } from '../indoor/search'
import type { Level } from '../indoor/types'

interface SearchBoxProps {
  places: Place[]
  levels: Level[]
  venueName: string
  peerCount: number
  meshUp: boolean
  onPick: (place: Place) => void
  onOpenMesh: () => void
}

export function SearchBox({ places, levels, venueName, peerCount, meshUp, onPick, onOpenMesh }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const hits = useMemo(() => searchPlaces(places, query, 8), [places, query])
  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? id
  const open = focused && query.trim().length > 0

  return (
    <div className={`search-card ${open ? 'open' : ''}`}>
      <div className="search-row">
        {open ? (
          <button type="button" className="icon-button" aria-label="Close search" onClick={() => { setQuery(''); setFocused(false) }}>
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span className="brand-mark" aria-hidden="true">G</span>
        )}
        <label className="sr-only" htmlFor="venue-search">Search {venueName}</label>
        <input
          id="venue-search"
          type="search"
          autoComplete="off"
          placeholder={`Search ${venueName}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setFocused(true)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) {
              onPick(hits[0].place)
              setQuery('')
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        {query ? (
          <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={18} />
          </button>
        ) : (
          <Search size={19} className="muted" aria-hidden="true" />
        )}
        <button
          type="button"
          className={`mesh-pill ${meshUp ? 'up' : ''}`}
          onClick={onOpenMesh}
          aria-label={`Mesh network: ${peerCount} peers`}
        >
          <Radio size={15} />
          <span>{peerCount}</span>
        </button>
      </div>
      {open && hits.length === 0 && (
        <p className="search-empty" role="status">
          No matches on this venue map
        </p>
      )}
      {open && hits.length > 0 && (
        <ul className="search-results" role="listbox" aria-label="Search results">
          {hits.map(({ place }) => (
            <li key={place.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(place)
                  setQuery('')
                  setFocused(false)
                }}
              >
                <MapPin size={18} className="muted" />
                <span>
                  <strong>{place.name}</strong>
                  <small>{levelName(place.levelId)} · {place.category.replace('-', ' ')}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
