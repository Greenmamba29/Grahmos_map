import {
  Accessibility,
  ArrowDownUp,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Footprints,
  MoveUpLeft,
  MoveUpRight,
  Navigation,
  Play,
  RotateCcw,
  Square,
  X,
} from 'lucide-react'
import type { Place } from '../indoor/search'
import type { Level } from '../indoor/types'
import { formatDuration, type Route, type RouteStep } from '../routing/router'

export type Origin = { type: 'me' } | { type: 'place'; placeId: string }

interface DirectionsSheetProps {
  places: Place[]
  levels: Level[]
  origin: Origin
  destinationId: string | null
  stepFree: boolean
  route: Route | null
  problem: string | null
  walking: boolean
  walkProgress: number | null
  onOrigin: (origin: Origin) => void
  onDestination: (id: string) => void
  onSwap: () => void
  onStepFree: (value: boolean) => void
  onSimulate: () => void
  onStopSimulate: () => void
  onFocusStep: (step: RouteStep) => void
  onClose: () => void
}

const stepIcon: Record<RouteStep['kind'], typeof ArrowUp> = {
  depart: Navigation,
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  'slight-left': MoveUpLeft,
  'slight-right': MoveUpRight,
  'u-turn': RotateCcw,
  level: ArrowDownUp,
  arrive: Flag,
}

export function DirectionsSheet(props: DirectionsSheetProps) {
  const { places, levels, origin, destinationId, stepFree, route, problem, walking, walkProgress } = props
  const sorted = [...places].sort((a, b) => a.name.localeCompare(b.name))
  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? id
  const optionLabel = (p: Place) => (p.name.includes(levelName(p.levelId)) ? p.name : `${p.name} · ${levelName(p.levelId)}`)
  const floors = route ? new Set(route.nodes.map((n) => n.levelId)).size - 1 : 0

  return (
    <section className="sheet directions" aria-label="Directions">
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <h2>Directions</h2>
        <button type="button" className="icon-button" aria-label="Close directions" onClick={props.onClose}>
          <X size={20} />
        </button>
      </header>

      <div className="od-grid">
        <div className="od-dots" aria-hidden="true">
          <span className="dot origin" />
          <span className="line" />
          <span className="dot destination" />
        </div>
        <div className="od-fields">
          <label>
            <span className="sr-only">Starting point</span>
            <select
              aria-label="Starting point"
              value={origin.type === 'me' ? 'me' : origin.placeId}
              onChange={(e) => props.onOrigin(e.target.value === 'me' ? { type: 'me' } : { type: 'place', placeId: e.target.value })}
            >
              <option value="me">Your location</option>
              {sorted.map((p) => (
                <option key={p.id} value={p.id}>
                  {optionLabel(p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Destination</span>
            <select aria-label="Destination" value={destinationId ?? ''} onChange={(e) => props.onDestination(e.target.value)}>
              <option value="" disabled>
                Choose destination
              </option>
              {sorted.map((p) => (
                <option key={p.id} value={p.id}>
                  {optionLabel(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="icon-button" aria-label="Swap start and destination" onClick={props.onSwap}>
          <ArrowDownUp size={18} />
        </button>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={stepFree} onChange={(e) => props.onStepFree(e.target.checked)} />
        <Accessibility size={17} /> Step-free route (elevators only)
      </label>

      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}

      {route && (
        <>
          <div className="route-summary">
            <div>
              <strong className="eta">{formatDuration(route.seconds)}</strong>
              <span className="muted">
                {' '}
                ({Math.round(route.meters)} m{floors > 0 ? ` · ${floors} floor${floors > 1 ? 's' : ''}` : ''})
              </span>
            </div>
            {walking ? (
              <button type="button" className="secondary-action" onClick={props.onStopSimulate}>
                <Square size={16} /> Stop
              </button>
            ) : (
              <button type="button" className="primary-action" onClick={props.onSimulate}>
                <Play size={16} /> Simulate walk
              </button>
            )}
          </div>
          {walkProgress !== null && (
            <div className="progress" role="progressbar" aria-valuenow={Math.round(walkProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${walkProgress * 100}%` }} />
            </div>
          )}
          <ol className="steps">
            {route.steps.map((step, i) => {
              const Icon = stepIcon[step.kind] ?? Footprints
              return (
                <li key={i}>
                  <button type="button" onClick={() => props.onFocusStep(step)}>
                    <Icon size={18} />
                    <span>
                      {step.instruction}
                      <small>{levelName(step.levelId)}</small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}
