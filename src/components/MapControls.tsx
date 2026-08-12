import { LocateFixed, Route } from 'lucide-react'

interface MapControlsProps {
  locating: boolean
  onLocate: () => void
}

export function MapControls({ locating, onLocate }: MapControlsProps) {
  return (
    <div className="map-controls">
      <button
        className="floating-map-button locate-button"
        type="button"
        aria-label="Go to my location"
        onClick={onLocate}
      >
        <LocateFixed className={locating ? 'spin-pulse' : ''} size={21} />
      </button>
      <button
        className="route-fab"
        type="button"
        aria-label="Plan a resilient route"
      >
        <Route size={25} />
      </button>
    </div>
  )
}
