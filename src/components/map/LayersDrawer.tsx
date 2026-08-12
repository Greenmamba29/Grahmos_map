import {
  Check,
  CloudDownload,
  Layers3,
  Map,
  Mountain,
  Satellite,
  X,
} from 'lucide-react'
import type {
  FacilityCategory,
  LayerPreferences,
  MapTheme,
} from '../../types/facilities'

const basemaps: Array<{
  id: MapTheme
  label: string
  description: string
  icon: typeof Map
}> = [
  { id: 'resilience', label: 'Resilience', description: 'Offline vector', icon: Map },
  { id: 'terrain', label: 'Terrain', description: 'Elevation ready', icon: Mountain },
  { id: 'satellite', label: 'Satellite', description: 'Package needed', icon: Satellite },
]

const categories: Array<{ id: FacilityCategory; label: string; color: string }> = [
  { id: 'hospital', label: 'Hospitals', color: '#D93025' },
  { id: 'school', label: 'Schools', color: '#7B61FF' },
  { id: 'shelter', label: 'Shelters', color: '#1A73E8' },
  { id: 'water', label: 'Water sources', color: '#0097A7' },
  { id: 'power', label: 'Power', color: '#F9AB00' },
]

interface LayersDrawerProps {
  open: boolean
  preferences: LayerPreferences
  onClose: () => void
  onChange: (preferences: LayerPreferences) => void
}

export function LayersDrawer({
  open,
  preferences,
  onClose,
  onChange,
}: LayersDrawerProps) {
  if (!open) return null

  const setTheme = (theme: MapTheme) => {
    if (theme === 'satellite') return
    onChange({
      ...preferences,
      theme,
      terrain: theme === 'terrain',
    })
  }

  const toggleCategory = (category: FacilityCategory) => {
    onChange({
      ...preferences,
      categories: {
        ...preferences.categories,
        [category]: !preferences.categories[category],
      },
    })
  }

  return (
    <>
      <button
        className="drawer-scrim"
        type="button"
        aria-label="Close layers"
        onClick={onClose}
      />
      <aside className="layers-drawer" aria-label="Map layers">
        <header className="drawer-header">
          <div className="drawer-heading">
            <span className="drawer-icon"><Layers3 size={20} /></span>
            <div>
              <p className="eyebrow">Map settings</p>
              <h2>Layers</h2>
            </div>
          </div>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <section className="drawer-section">
          <h3>Map type</h3>
          <div className="basemap-grid">
            {basemaps.map(({ id, label, description, icon: Icon }) => {
              const selected = preferences.theme === id
              const disabled = id === 'satellite'
              return (
                <button
                  key={id}
                  className={`basemap-card ${selected ? 'selected' : ''}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTheme(id)}
                >
                  <span className={`basemap-preview ${id}`}><Icon size={22} /></span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                  {selected && <span className="selected-check"><Check size={12} /></span>}
                </button>
              )
            })}
          </div>
        </section>

        <section className="drawer-section">
          <h3>Critical facilities</h3>
          <div className="layer-list">
            {categories.map(({ id, label, color }) => (
              <label className="layer-row" key={id}>
                <span className="layer-label">
                  <span className="category-dot" style={{ backgroundColor: color }} />
                  {label}
                </span>
                <input
                  className="toggle-input"
                  type="checkbox"
                  checked={preferences.categories[id]}
                  onChange={() => toggleCategory(id)}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <h3>Offline data</h3>
          <label className="layer-row">
            <span className="layer-label">
              <CloudDownload size={18} />
              Downloaded regions
            </span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={preferences.downloadedRegions}
              onChange={() =>
                onChange({
                  ...preferences,
                  downloadedRegions: !preferences.downloadedRegions,
                })
              }
            />
          </label>
          <p className="drawer-note">
            Dashed blue boundaries show maps available without a connection.
          </p>
        </section>
      </aside>
    </>
  )
}
