import { AlertTriangle, CornerUpRight, LocateFixed, X } from 'lucide-react'
import type { Place } from '../indoor/search'
import type { Level } from '../indoor/types'
import type { Annotation } from '../mesh/protocol'

interface PlaceSheetProps {
  place: Place
  levels: Level[]
  warnings: Annotation[]
  onDirections: () => void
  onImHere: () => void
  onReport: () => void
  onClose: () => void
}

export function PlaceSheet({ place, levels, warnings, onDirections, onImHere, onReport, onClose }: PlaceSheetProps) {
  const level = levels.find((l) => l.id === place.levelId)
  return (
    <section className="sheet" aria-label={`${place.name} details`}>
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <div>
          <h2>{place.name}</h2>
          <p className="muted">
            {place.category.replace('-', ' ')} · {level?.name ?? place.levelId}
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {warnings.length > 0 && (
        <div className="warning-banner" role="alert">
          <AlertTriangle size={16} />
          <span>{warnings.map((w) => w.text).join(' · ')}</span>
        </div>
      )}
      <div className="action-row">
        <button type="button" className="primary-action" onClick={onDirections}>
          <CornerUpRight size={18} /> Directions
        </button>
        <button type="button" className="secondary-action" onClick={onImHere}>
          <LocateFixed size={18} /> I'm here
        </button>
        <button type="button" className="secondary-action" onClick={onReport}>
          <AlertTriangle size={18} /> Report
        </button>
      </div>
      {place.keywords.length > 0 && (
        <p className="keywords">{[...new Set(place.keywords)].slice(0, 6).join(' · ')}</p>
      )}
    </section>
  )
}
