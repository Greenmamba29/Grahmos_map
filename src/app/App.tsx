import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Crosshair,
  Layers3,
  Navigation,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import {
  MapCanvas,
  type MapCanvasHandle,
} from '../components/map/MapCanvas'
import { LayersDrawer } from '../components/map/LayersDrawer'
import { BottomNav } from '../components/ui/BottomNav'
import { CategoryChips } from '../components/ui/CategoryChips'
import { SearchBar } from '../components/ui/SearchBar'
import { useFacilities } from '../hooks/useFacilities'
import {
  facilityCategories,
  type FacilityCategory,
  type LayerPreferences,
} from '../types/facilities'

const initialPreferences: LayerPreferences = {
  theme: 'resilience',
  terrain: false,
  downloadedRegions: true,
  categories: {
    hospital: true,
    school: true,
    shelter: true,
    water: true,
    power: true,
  },
}

export function App() {
  const mapRef = useRef<MapCanvasHandle>(null)
  const [layersOpen, setLayersOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeNav, setActiveNav] = useState('Explore')
  const [notice, setNotice] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [preferences, setPreferences] =
    useState<LayerPreferences>(initialPreferences)

  const activeCategories = useMemo(
    () =>
      new Set(
        facilityCategories.filter((category) => preferences.categories[category]),
      ),
    [preferences.categories],
  )
  const { facilities, source } = useFacilities(activeCategories)
  const visibleFacilities = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return facilities
    return facilities.filter(
      (facility) =>
        facility.name.toLowerCase().includes(normalized) ||
        facility.category.includes(normalized) ||
        facility.address?.toLowerCase().includes(normalized),
    )
  }, [facilities, query])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const toggleCategory = (category: FacilityCategory) => {
    setPreferences((current) => ({
      ...current,
      categories: {
        ...current.categories,
        [category]: !current.categories[category],
      },
    }))
  }

  const navigate = (label: string) => {
    if (label === 'Explore') {
      setActiveNav(label)
      return
    }
    setNotice(`${label} is planned in the next build phase`)
  }

  return (
    <main className="app-shell">
      <MapCanvas
        ref={mapRef}
        facilities={visibleFacilities}
        preferences={preferences}
      />

      <section className="top-controls" aria-label="Map search and categories">
        <div className="search-row">
          <SearchBar
            value={query}
            onChange={setQuery}
            onFilter={() => setNotice('Facility filters are coming next')}
          />
          <button
            className="layers-button"
            type="button"
            aria-label="Open map layers"
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen(true)}
          >
            <Layers3 size={21} />
          </button>
        </div>
        <CategoryChips active={activeCategories} onToggle={toggleCategory} />
      </section>

      <div className={`connectivity-badge ${online ? '' : 'offline'}`}>
        {online ? <ShieldCheck size={14} /> : <WifiOff size={14} />}
        <span>
          {online
            ? `${visibleFacilities.length} facilities · ${source}`
            : 'Offline data in use'}
        </span>
      </div>

      <div className="map-actions">
        <button
          className="map-fab location"
          type="button"
          aria-label="Go to my location"
          onClick={() => mapRef.current?.locate()}
        >
          <Crosshair size={22} />
        </button>
        <button
          className="map-fab route"
          type="button"
          aria-label="Plan a resilient route"
          onClick={() => setNotice('Choose a facility to start a resilient route')}
        >
          <Navigation size={25} fill="currentColor" />
        </button>
      </div>

      <BottomNav active={activeNav} onChange={navigate} />

      <LayersDrawer
        open={layersOpen}
        preferences={preferences}
        onClose={() => setLayersOpen(false)}
        onChange={setPreferences}
      />

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </main>
  )
}
