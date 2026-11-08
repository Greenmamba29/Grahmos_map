import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { bbox, centroid, pointInPolygon } from '../indoor/geometry'
import type { IndoorPosition, Point, Space, Venue } from '../indoor/types'
import type { Annotation, PeerPresence } from '../mesh/protocol'
import { amenityStyle, annotationStyle, spaceFill } from './mapStyles'
import type { Route } from '../routing/router'

interface View {
  x: number
  y: number
  k: number
}

export interface FloorMapHandle {
  focus: (point: Point, zoom?: number) => void
  fit: () => void
}

interface FloorMapProps {
  venue: Venue
  levelId: string
  selectedId?: string | null
  route?: Route | null
  position?: IndoorPosition | null
  peers?: PeerPresence[]
  annotations?: Annotation[]
  /** When set, the cursor becomes a crosshair and clicks place a pin. */
  placing?: boolean
  onSelectSpace?: (space: Space) => void
  onSelectAmenity?: (id: string) => void
  onSelectAnnotation?: (annotation: Annotation) => void
  onMapClick?: (levelId: string, point: Point) => void
}

const MIN_K = 2
const MAX_K = 80

export const FloorMap = forwardRef<FloorMapHandle, FloorMapProps>(function FloorMap(
  {
    venue,
    levelId,
    selectedId,
    route,
    position,
    peers = [],
    annotations = [],
    placing,
    onSelectSpace,
    onSelectAmenity,
    onSelectAnnotation,
    onMapClick,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 390, height: 720 })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 8 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: number; startDist?: number; startK?: number } | null>(null)
  /** Becomes true once the user pans/zooms; until then the map auto-fits. */
  const interacted = useRef(false)

  const level = venue.levels.find((l) => l.id === levelId) ?? venue.levels[0]
  const spaces = useMemo(() => venue.spaces.filter((s) => s.levelId === level.id), [venue, level.id])
  const amenities = useMemo(() => venue.amenities.filter((a) => a.levelId === level.id), [venue, level.id])
  const box = useMemo(() => bbox(level.outline), [level.outline])

  const fitView = useCallback((): View => {
    const pad = 32
    const top = 150
    const bottom = 110
    const w = box.maxX - box.minX
    const h = box.maxY - box.minY
    const k = Math.min((size.width - pad * 2) / w, (size.height - top - bottom) / h)
    const clamped = Math.max(MIN_K, Math.min(MAX_K, k))
    return {
      k: clamped,
      x: (size.width - w * clamped) / 2 - box.minX * clamped,
      y: top + (size.height - top - bottom - h * clamped) / 2 - box.minY * clamped,
    }
  }, [box, size])

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const rect = svg.getBoundingClientRect()
      if (rect.width && rect.height) setSize({ width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  // Keep the floor fitted to the viewport until the user takes control.
  useEffect(() => {
    if (interacted.current) return
    setView(fitView())
  }, [fitView])

  useImperativeHandle(ref, () => ({
    focus(point, zoom) {
      interacted.current = true
      setView((current) => {
        const k = zoom ?? Math.max(current.k, 10)
        return { k, x: size.width / 2 - point[0] * k, y: size.height * 0.45 - point[1] * k }
      })
    },
    fit() {
      interacted.current = false
      setView(fitView())
    },
  }))

  const toWorld = useCallback(
    (sx: number, sy: number): Point => [(sx - view.x) / view.k, (sy - view.y) / view.k],
    [view],
  )
  const toScreen = (p: Point): Point => [p[0] * view.k + view.x, p[1] * view.k + view.y]

  const zoomAt = (sx: number, sy: number, factor: number) => {
    interacted.current = true
    setView((current) => {
      const k = Math.max(MIN_K, Math.min(MAX_K, current.k * factor))
      const ratio = k / current.k
      return { k, x: sx - (sx - current.x) * ratio, y: sy - (sy - current.y) * ratio }
    })
  }

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    // Let markers receive their own click events (capture would retarget them).
    if ((event.target as Element).closest('[data-marker]')) return
    svgRef.current?.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, local(event))
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { moved: 99, startDist: Math.hypot(a.x - b.x, a.y - b.y), startK: view.k }
    } else {
      gesture.current = { moved: 0 }
    }
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous || !gesture.current) return
    const next = local(event)
    pointers.current.set(event.pointerId, next)
    if (pointers.current.size === 2 && gesture.current.startDist) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const target = (gesture.current.startK! * dist) / gesture.current.startDist
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / view.k)
      return
    }
    const dx = next.x - previous.x
    const dy = next.y - previous.y
    gesture.current.moved += Math.abs(dx) + Math.abs(dy)
    if (gesture.current.moved > 6) interacted.current = true
    setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    pointers.current.delete(event.pointerId)
    if (pointers.current.size > 0) return
    gesture.current = null
    if (!g || g.moved > 6) return
    const target = event.target as Element
    if (target.closest('[data-marker]')) return
    const { x, y } = local(event)
    const world = toWorld(x, y)
    if (placing) {
      onMapClick?.(level.id, world)
      return
    }
    const hit = [...spaces].reverse().find((s) => s.category !== 'corridor' && pointInPolygon(world, s.polygon))
    if (hit) onSelectSpace?.(hit)
    else onMapClick?.(level.id, world)
  }

  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    const { x, y } = local(event)
    zoomAt(x, y, Math.exp(-event.deltaY * 0.0015))
  }

  const routeLevels = useMemo(() => {
    if (!route) return { here: [] as Point[][], connectors: [] as { point: Point; label: string }[] }
    const here: Point[][] = []
    const connectors: { point: Point; label: string }[] = []
    let current: Point[] = []
    for (let i = 0; i < route.nodes.length; i++) {
      const node = route.nodes[i]
      if (node.levelId === level.id) current.push(node.position)
      else if (current.length) {
        here.push(current)
        current = []
      }
      const next = route.nodes[i + 1]
      if (next && next.levelId !== node.levelId && (node.levelId === level.id || next.levelId === level.id)) {
        const target = venue.levels.find((l) => l.id === (node.levelId === level.id ? next.levelId : node.levelId))
        const own = node.levelId === level.id ? node : next
        connectors.push({ point: own.position, label: target?.shortName ?? '?' })
      }
    }
    if (current.length) here.push(current)
    return { here, connectors }
  }, [route, level.id, venue.levels])

  const destination = route?.nodes.at(-1)
  const origin = route?.nodes[0]

  return (
    <svg
      ref={svgRef}
      className={`floor-map ${placing ? 'placing' : ''}`}
      role="application"
      aria-label={`${venue.name}, ${level.name} floor plan`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <defs>
        <pattern id="hatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1.2" stroke="#d93025" strokeWidth="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#e8eaed" />
      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        <polygon
          points={level.outline.map((p) => p.join(',')).join(' ')}
          fill="#fafafa"
          stroke="#9aa0a6"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
        {spaces.map((space) => (
          <polygon
            key={space.id}
            data-space={space.id}
            points={space.polygon.map((p) => p.join(',')).join(' ')}
            fill={space.id === selectedId ? '#d2e3fc' : spaceFill[space.category]}
            stroke={space.id === selectedId ? '#1a73e8' : '#c4c7c5'}
            strokeWidth={space.id === selectedId ? 2 : 1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {annotations
          .filter((a) => a.levelId === level.id && (a.type === 'closure' || a.type === 'hazard'))
          .map((a) => (
            <circle
              key={`zone-${a.id}`}
              cx={a.position[0]}
              cy={a.position[1]}
              r={a.radius}
              fill={a.type === 'closure' ? 'url(#hatch)' : 'rgba(227,116,0,0.18)'}
              stroke={annotationStyle[a.type].color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        {routeLevels.here.map((points, i) => (
          <g key={`route-${i}`}>
            <polyline
              points={points.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke="#1558b0"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              className="route-line"
              points={points.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke="#4285f4"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        {position && position.levelId === level.id && (
          <circle
            cx={position.position[0]}
            cy={position.position[1]}
            r={Math.max(position.accuracy, 0.8)}
            fill="rgba(66,133,244,0.16)"
            stroke="rgba(66,133,244,0.4)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </g>

      {/* Screen-space overlay: constant-size labels and markers. */}
      <g className="labels" pointerEvents="none">
        {spaces
          .filter((s) => s.category !== 'corridor')
          .map((space) => {
            const b = bbox(space.polygon)
            const widthPx = (b.maxX - b.minX) * view.k
            if (widthPx < 46) return null
            const [x, y] = toScreen(centroid(space.polygon))
            const maxChars = Math.floor(widthPx / 6.6)
            const label = space.name.length > maxChars ? `${space.name.slice(0, Math.max(3, maxChars - 1))}…` : space.name
            return (
              <text key={space.id} x={x} y={y} className="space-label" textAnchor="middle" dominantBaseline="middle">
                {label}
              </text>
            )
          })}
      </g>

      {amenities.map((amenity) => {
        const { icon: Icon, color } = amenityStyle[amenity.category]
        const [x, y] = toScreen(amenity.position)
        return (
          <g
            key={amenity.id}
            data-marker
            className="marker"
            transform={`translate(${x} ${y})`}
            onClick={() => onSelectAmenity?.(amenity.id)}
            role="button"
            aria-label={amenity.name}
          >
            <circle r={12} fill={amenity.id === selectedId ? '#1a73e8' : color} stroke="#fff" strokeWidth={2} />
            <Icon x={-7} y={-7} size={14} color="#fff" strokeWidth={2.4} />
          </g>
        )
      })}

      {routeLevels.connectors.map((c, i) => {
        const [x, y] = toScreen(c.point)
        return (
          <g key={`connector-${i}`} transform={`translate(${x} ${y})`} pointerEvents="none">
            <rect x={-13} y={-24} width={26} height={18} rx={9} fill="#1a73e8" />
            <text y={-11} textAnchor="middle" className="connector-label">{`L${c.label}`}</text>
          </g>
        )
      })}

      {origin && origin.levelId === level.id && (
        <circle
          cx={toScreen(origin.position)[0]}
          cy={toScreen(origin.position)[1]}
          r={7}
          fill="#fff"
          stroke="#1a73e8"
          strokeWidth={3}
          pointerEvents="none"
        />
      )}
      {destination && destination.levelId === level.id && (
        <g transform={`translate(${toScreen(destination.position)[0]} ${toScreen(destination.position)[1]})`} pointerEvents="none">
          <path d="M0 0 C -9 -12 -11 -16 -11 -21 a 11 11 0 0 1 22 0 c 0 5 -2 9 -11 21z" fill="#ea4335" stroke="#b31412" strokeWidth={1} />
          <circle cy={-21} r={4} fill="#b31412" />
        </g>
      )}

      {annotations
        .filter((a) => a.levelId === level.id)
        .map((a) => {
          const { icon: Icon, color, label } = annotationStyle[a.type]
          const [x, y] = toScreen(a.position)
          return (
            <g
              key={a.id}
              data-marker
              className={`marker annotation ${a.type === 'sos' ? 'pulse' : ''}`}
              transform={`translate(${x} ${y})`}
              onClick={() => onSelectAnnotation?.(a)}
              role="button"
              aria-label={`${label}: ${a.text}`}
            >
              <rect x={-13} y={-13} width={26} height={26} rx={7} fill={color} stroke="#fff" strokeWidth={2} />
              <Icon x={-8} y={-8} size={16} color="#fff" strokeWidth={2.4} />
            </g>
          )
        })}

      {peers
        .filter((p) => p.levelId === level.id && p.position)
        .map((peer) => {
          const [x, y] = toScreen(peer.position!)
          return (
            <g key={peer.peerId} transform={`translate(${x} ${y})`} className="peer" aria-label={`Peer ${peer.name}`} role="img">
              <circle r={9} fill="#9334e6" stroke="#fff" strokeWidth={2.5} />
              <text y={-15} textAnchor="middle" className="peer-label">{peer.name}</text>
            </g>
          )
        })}

      {position && position.levelId === level.id && (
        <g transform={`translate(${toScreen(position.position)[0]} ${toScreen(position.position)[1]})`} pointerEvents="none" aria-label="Your location" role="img">
          <circle r={11} fill="#fff" />
          <circle r={8} fill="#1a73e8" className="blue-dot" />
        </g>
      )}
    </svg>
  )
})
