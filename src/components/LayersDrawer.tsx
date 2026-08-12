import {
  Check,
  Download,
  Layers3,
  Map,
  Mountain,
  Satellite,
  X,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { layerAvailability } from '../lib/mapStyle'
import {
  categoryLabels,
  facilityCategories,
  type BaseLayer,
  type FacilityCategory,
  type LayerState,
} from '../types/map'

interface LayersDrawerProps {
  open: boolean
  state: LayerState
  onOpen: () => void
  onClose: () => void
  onBaseLayerChange: (layer: BaseLayer) => void
  onTerrainToggle: () => void
  onOfflineRegionsToggle: () => void
  onCategoryToggle: (category: FacilityCategory) => void
}

const baseLayers: {
  id: BaseLayer
  label: string
  icon: LucideIcon
  available: boolean
}[] = [
  {
    id: 'terrain',
    label: 'Terrain',
    icon: Mountain,
    available: layerAvailability.terrain,
  },
  { id: 'streets', label: 'Streets', icon: Map, available: true },
  {
    id: 'satellite',
    label: 'Satellite',
    icon: Satellite,
    available: layerAvailability.satellite,
  },
]

export function LayersDrawer({
  open,
  state,
  onOpen,
  onClose,
  onBaseLayerChange,
  onTerrainToggle,
  onOfflineRegionsToggle,
  onCategoryToggle,
}: LayersDrawerProps) {
  return (
    <>
      <button
        className="floating-map-button layers-trigger"
        type="button"
        aria-label="Map layers"
        aria-expanded={open}
        onClick={onOpen}
      >
        <Layers3 size={21} />
      </button>

      <button
        className={clsx('drawer-scrim', open && 'visible')}
        type="button"
        aria-label="Close layers"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        className={clsx('layers-drawer', open && 'open')}
        inert={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Map layers"
      >
        <div className="drawer-handle" />
        <div className="drawer-title-row">
          <div>
            <p className="eyebrow">Map settings</p>
            <h2>Layers</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close layers"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>

        <section>
          <h3>Map type</h3>
          <div className="map-type-grid">
            {baseLayers.map(({ id, label, icon: Icon, available }) => (
              <button
                className={clsx(
                  'map-type-card',
                  state.baseLayer === id && 'selected',
                )}
                key={id}
                type="button"
                disabled={!available}
                onClick={() => onBaseLayerChange(id)}
              >
                <span className={`map-type-preview ${id}`}>
                  <Icon size={22} />
                  {state.baseLayer === id && (
                    <span className="selected-check">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span>{label}</span>
                {!available && <small>Not downloaded</small>}
              </button>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <h3>Map details</h3>
          <button
            className="setting-row"
            type="button"
            onClick={onTerrainToggle}
            disabled={!layerAvailability.terrain}
          >
            <span className="setting-icon terrain">
              <Mountain size={19} />
            </span>
            <span className="setting-copy">
              <strong>3D terrain</strong>
              <small>
                {layerAvailability.terrain
                  ? 'Show elevation and hillshade'
                  : 'Download a terrain archive to enable'}
              </small>
            </span>
            <span
              className={clsx('toggle', state.terrainEnabled && 'enabled')}
              aria-hidden="true"
            >
              <span />
            </span>
          </button>
          <button
            className="setting-row"
            type="button"
            onClick={onOfflineRegionsToggle}
          >
            <span className="setting-icon offline">
              <Download size={19} />
            </span>
            <span className="setting-copy">
              <strong>Offline regions</strong>
              <small>Show downloaded boundaries</small>
            </span>
            <span
              className={clsx(
                'toggle',
                state.offlineRegionsVisible && 'enabled',
              )}
              aria-hidden="true"
            >
              <span />
            </span>
          </button>
        </section>

        <section className="drawer-section">
          <h3>Critical facilities</h3>
          <div className="layer-pills">
            {facilityCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={clsx(
                  'layer-pill',
                  state.categories[category] && 'enabled',
                )}
                onClick={() => onCategoryToggle(category)}
              >
                <span className={`facility-swatch ${category}`} />
                {categoryLabels[category]}
                {state.categories[category] && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </>
  )
}
