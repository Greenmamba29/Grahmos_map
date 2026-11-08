import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accessibility,
  Bath,
  CircleDot,
  Compass,
  CornerUpRight,
  DoorOpen,
  Droplets,
  HardDriveDownload,
  HeartPulse,
  LocateFixed,
  Radio,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { FloorMap, type FloorMapHandle } from '../components/FloorMap'
import { annotationStyle } from '../components/mapStyles'
import { SearchBox } from '../components/SearchBox'
import { PlaceSheet } from '../components/PlaceSheet'
import { DirectionsSheet, type Origin } from '../components/DirectionsSheet'
import { MeshSheet } from '../components/MeshSheet'
import { OfflineSheet } from '../components/OfflineSheet'
import { createDemoVenue } from '../indoor/demoVenue'
import { distance, pointInPolygon } from '../indoor/geometry'
import { venuePlaces, type Place } from '../indoor/search'
import type { Point, Venue } from '../indoor/types'
import { blockedNodesFor, parseVenue, serializeVenue } from '../indoor/venuePackage'
import { storage } from '../lib/storage'
import { useMesh } from '../hooks/useMesh'
import { usePositioning } from '../hooks/usePositioning'
import { randomId, type AnnotationType } from '../mesh/protocol'
import { IndoorRouter } from '../routing/router'
import { routeToNearest } from '../routing/nearest'

type Sheet = 'none' | 'place' | 'directions' | 'mesh' | 'offline'

interface ReportDraft {
  type: AnnotationType
  levelId?: string
  position?: Point
}

const demoVenue = createDemoVenue()

const quickCategories: { label: string; icon: LucideIcon; match: (p: Place) => boolean }[] = [
  { label: 'Exits', icon: DoorOpen, match: (p) => p.category === 'exit' },
  { label: 'Restrooms', icon: Bath, match: (p) => p.category === 'restroom' },
  { label: 'Medical', icon: HeartPulse, match: (p) => ['medical', 'aed', 'first-aid'].includes(p.category) },
  { label: 'Food', icon: Utensils, match: (p) => p.category === 'food' },
  { label: 'Water', icon: Droplets, match: (p) => p.category === 'water' },
  { label: 'Elevators', icon: Accessibility, match: (p) => p.category === 'elevator' },
]

export function App() {
  const mapRef = useRef<FloorMapHandle>(null)
  const [venues, setVenues] = useState<Venue[]>([demoVenue])
  const [venueId, setVenueId] = useState(demoVenue.id)
  const venue = venues.find((v) => v.id === venueId) ?? demoVenue
  const [levelId, setLevelId] = useState(venue.levels[0].id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>('none')
  const [origin, setOrigin] = useState<Origin>({ type: 'me' })
  const [destinationId, setDestinationId] = useState<string | null>(null)
  const [stepFree, setStepFree] = useState(false)
  const [report, setReport] = useState<ReportDraft | null>(null)
  const [reportText, setReportText] = useState('')
  const [reportRadius, setReportRadius] = useState(3)
  const [notice, setNotice] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(() => Boolean(navigator.serviceWorker?.controller))

  const places = useMemo(() => venuePlaces(venue), [venue])
  const router = useMemo(() => new IndoorRouter(venue), [venue])
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])

  const flash = useCallback((message: string) => setNotice(message), [])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3200)
    return () => clearTimeout(t)
  }, [notice])

  // ---- Offline venue library -------------------------------------------
  useEffect(() => {
    void storage.listVenues().then((stored) => {
      if (stored.length) setVenues([demoVenue, ...stored.filter((v) => v.id !== demoVenue.id)])
    })
    void storage.getSetting<string>('activeVenue').then((id) => {
      if (id) setVenueId(id)
    })
    void storage.persist()
    const update = () => setOnline(navigator.onLine)
    const ready = () => setOfflineReady(true)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('grahmos:offline-ready', ready)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('grahmos:offline-ready', ready)
    }
  }, [])

  const installVenue = useCallback(async (next: Venue, announce: string) => {
    await storage.saveVenue(next)
    setVenues((current) => [...current.filter((v) => v.id !== next.id), next])
    flash(announce)
  }, [flash])

  const positioning = usePositioning(venue)
  const { position, turnOff: positioningOff } = positioning

  const selectVenue = useCallback((id: string) => {
    positioningOff()
    setVenueId(id)
    void storage.setSetting('activeVenue', id)
  }, [positioningOff])

  // Reset per-venue UI state when the active venue changes (render-time adjustment).
  const [shownVenue, setShownVenue] = useState(venue)
  if (shownVenue !== venue) {
    setShownVenue(venue)
    setLevelId(venue.levels.find((l) => l.ordinal === 0)?.id ?? venue.levels[0].id)
    setSelectedId(null)
    setDestinationId(null)
    setOrigin({ type: 'me' })
  }
  useEffect(() => {
    mapRef.current?.fit()
  }, [venue])

  // ---- Mesh ------------------------------------------------------------
  const venuesRef = useRef(venues)
  useEffect(() => {
    venuesRef.current = venues
  }, [venues])
  const onMeshVenue = useCallback(
    (incoming: unknown) => {
      try {
        const parsed = parseVenue(incoming)
        const existing = venuesRef.current.find((v) => v.id === parsed.id)
        if (existing && existing.version >= parsed.version) return
        void installVenue(parsed, `Received map "${parsed.name}" over the mesh`)
      } catch {
        // ignore invalid packages from peers
      }
    },
    [installVenue],
  )
  const mesh = useMesh(venue.id, onMeshVenue)
  const { node } = mesh
  const annotations = useMemo(
    () => node.activeAnnotations(venue.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node, venue.id, mesh.revision],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const peers = useMemo(() => node.activePeers().filter((p) => !p.venueId || p.venueId === venue.id), [node, venue.id, mesh.revision])
  const blocked = useMemo(() => blockedNodesFor(venue, annotations), [venue, annotations])
  const meshUp = node.links().some((l) => l.status === 'up')

  // ---- Positioning -----------------------------------------------------
  const lastLevel = useRef<string | null>(null)
  useEffect(() => {
    if (!position) return
    if (position.levelId !== lastLevel.current && positioning.mode !== 'manual') setLevelId(position.levelId)
    lastLevel.current = position.levelId
  }, [position, positioning.mode])

  const lastPresence = useRef(0)
  useEffect(() => {
    if (!position || Date.now() - lastPresence.current < 2500) return
    lastPresence.current = Date.now()
    node.updatePresence({ levelId: position.levelId, position: position.position, accuracy: position.accuracy })
  }, [node, position])

  // ---- Routing ---------------------------------------------------------
  const originNodeId = useMemo(() => {
    if (origin.type === 'place') return placeById.get(origin.placeId)?.nodeId ?? null
    if (!position) return null
    return router.nearestNode(position.levelId, position.position, { blockedNodes: blocked })?.id ?? null
  }, [origin, placeById, position, router, blocked])

  const destination = destinationId ? placeById.get(destinationId) ?? null : null
  const route = useMemo(() => {
    if (sheet !== 'directions' || !originNodeId || !destination?.nodeId) return null
    return router.route(originNodeId, destination.nodeId, { stepFree, blockedNodes: blocked }) ?? null
  }, [sheet, originNodeId, destination, router, stepFree, blocked])

  const problem = useMemo(() => {
    if (sheet !== 'directions') return null
    if (!destination) return 'Choose where you want to go.'
    if (!originNodeId)
      return origin.type === 'me'
        ? 'Your location is unknown. Tap a room and choose "I\'m here", or use the locate button to scan Bluetooth beacons.'
        : 'That starting point has no walkable entrance.'
    if (!route) {
      return blocked.has(destination.nodeId ?? '')
        ? 'The destination is inside a reported closure. Pick another destination.'
        : `No ${stepFree ? 'step-free ' : ''}route available — reported closures may be blocking the way.`
    }
    return null
  }, [sheet, destination, originNodeId, origin.type, route, blocked, stepFree])

  const openDirections = (placeId: string) => {
    setDestinationId(placeId)
    setSheet('directions')
  }

  const pickPlace = (place: Place) => {
    setSelectedId(place.id)
    setLevelId(place.levelId)
    setSheet('place')
    mapRef.current?.focus(place.position, 12)
  }

  const goNearest = (label: string, match: (p: Place) => boolean) => {
    const fromNode =
      originNodeId ?? (position ? router.nearestNode(position.levelId, position.position)?.id : undefined)
    if (fromNode) {
      const nearest = routeToNearest(router, fromNode, places, match, { stepFree, blockedNodes: blocked })
      if (nearest) {
        setLevelId(router.nodes.get(fromNode)!.levelId)
        openDirections(nearest.place.id)
        return
      }
      flash(`No reachable ${label.toLowerCase()} — closures may be blocking the way`)
      return
    }
    // Unknown location: highlight the closest match on the floor being viewed.
    const onLevel = places.filter((p) => match(p) && p.levelId === levelId)
    const pool = onLevel.length ? onLevel : places.filter(match)
    if (!pool.length) {
      flash(`No ${label.toLowerCase()} on this map`)
      return
    }
    const center: Point = [42, 25]
    pickPlace(pool.sort((a, b) => distance(a.position, center) - distance(b.position, center))[0])
  }

  const locate = () => {
    if (position) {
      setLevelId(position.levelId)
      mapRef.current?.focus(position.position, 14)
      return
    }
    if (positioning.bluetoothScanSupported) {
      void positioning.startBluetooth()
      flash('Scanning for venue Bluetooth beacons…')
    } else {
      flash('Bluetooth scanning unavailable here — tap a room and choose "I\'m here", or run a simulated walk')
    }
  }

  const simulate = () => {
    if (!route) return
    void positioning.startSimulatedWalk(route.nodes.map((n) => ({ levelId: n.levelId, position: n.position })))
    setLevelId(route.nodes[0].levelId)
    mapRef.current?.focus(route.nodes[0].position, 10)
  }

  // ---- Reporting -------------------------------------------------------
  const startReport = (type: AnnotationType, at?: { levelId: string; position: Point }) => {
    setReportText('')
    setReportRadius(type === 'closure' ? 3 : type === 'hazard' ? 4 : 1)
    if (at) setReport({ type, ...at })
    else if (type === 'sos' && position) setReport({ type, levelId: position.levelId, position: position.position })
    else {
      setReport({ type })
      setSheet('none')
      flash(`Tap the map where the ${annotationStyle[type].label.toLowerCase()} is`)
    }
  }

  const submitReport = () => {
    if (!report?.levelId || !report.position) return
    const now = Date.now()
    node.publishAnnotation({
      id: randomId(),
      venueId: venue.id,
      type: report.type,
      levelId: report.levelId,
      position: report.position,
      radius: report.type === 'closure' || report.type === 'hazard' ? reportRadius : 1,
      text: reportText.trim().slice(0, 200) || annotationStyle[report.type].label,
      author: node.peerId,
      authorName: node.name,
      createdAt: now,
      expiresAt: report.type === 'note' ? undefined : now + 12 * 60 * 60 * 1000,
      resolved: false,
    })
    flash(`${annotationStyle[report.type].label} shared with the mesh`)
    setReport(null)
  }

  const onMapClick = (clickedLevel: string, point: Point) => {
    if (report && !report.position) {
      setReport({ ...report, levelId: clickedLevel, position: point })
      return
    }
    setSelectedId(null)
    if (sheet === 'place') setSheet('none')
  }

  const selectedPlace = selectedId ? placeById.get(selectedId) ?? null : null
  const selectedWarnings = selectedPlace
    ? annotations.filter((a) => {
        if (a.levelId !== selectedPlace.levelId) return false
        const space = venue.spaces.find((s) => s.id === selectedPlace.id)
        return space ? pointInPolygon(a.position, space.polygon) : distance(a.position, selectedPlace.position) < a.radius + 2
      })
    : []

  const levelsDesc = [...venue.levels].sort((a, b) => b.ordinal - a.ordinal)
  const routeLevels = new Set(route?.nodes.map((n) => n.levelId))
  const activeNav = sheet === 'directions' ? 'Directions' : sheet === 'mesh' ? 'Mesh' : sheet === 'offline' ? 'Offline' : 'Explore'

  return (
    <main className="app-shell">
      <FloorMap
        ref={mapRef}
        venue={venue}
        levelId={levelId}
        selectedId={selectedId}
        route={route}
        position={position}
        peers={peers}
        annotations={annotations}
        placing={Boolean(report && !report.position)}
        onSelectSpace={(space) => {
          const place = placeById.get(space.id)
          if (place) {
            setSelectedId(place.id)
            setSheet('place')
          }
        }}
        onSelectAmenity={(id) => {
          setSelectedId(id)
          setSheet('place')
        }}
        onSelectAnnotation={(a) => flash(`${annotationStyle[a.type].label}: ${a.text} — by ${a.authorName}`)}
        onMapClick={onMapClick}
      />

      <section className="top-controls" aria-label="Search and quick categories">
        <SearchBox
          places={places}
          levels={venue.levels}
          venueName={venue.name}
          peerCount={peers.length}
          meshUp={meshUp}
          onPick={pickPlace}
          onOpenMesh={() => setSheet('mesh')}
        />
        <div className="chips" role="toolbar" aria-label="Find nearest">
          {quickCategories.map(({ label, icon: Icon, match }) => (
            <button key={label} type="button" className="chip" onClick={() => goNearest(label, match)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </section>

      <div className="status-badge" role="status">
        <CircleDot size={12} className={online ? 'ok' : 'warn'} />
        <span>
          {online ? 'Online' : 'Offline'} · {positioning.mode === 'off' ? 'location off' : `${positioning.mode} location`}
          {annotations.length > 0 && ` · ${annotations.length} alert${annotations.length > 1 ? 's' : ''}`}
        </span>
      </div>

      <nav className="floor-picker" aria-label="Floors">
        {levelsDesc.map((level) => (
          <button
            key={level.id}
            type="button"
            className={level.id === levelId ? 'active' : ''}
            aria-pressed={level.id === levelId}
            aria-label={level.name}
            onClick={() => setLevelId(level.id)}
          >
            {level.shortName}
            {position?.levelId === level.id && <span className="you-marker" aria-hidden="true" />}
            {routeLevels.has(level.id) && level.id !== levelId && <span className="route-marker" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="map-actions">
        <button
          type="button"
          className={`map-fab ${position ? 'active' : ''}`}
          aria-label="Show my location"
          onClick={locate}
        >
          <LocateFixed size={22} />
        </button>
        <button type="button" className="map-fab exit" aria-label="Route to nearest exit" onClick={() => goNearest('Exits', (p) => p.category === 'exit')}>
          <DoorOpen size={22} />
        </button>
        <button
          type="button"
          className="map-fab route"
          aria-label="Directions"
          onClick={() => {
            setSheet('directions')
            if (selectedId) setDestinationId(selectedId)
          }}
        >
          <CornerUpRight size={24} />
        </button>
      </div>

      {sheet === 'place' && selectedPlace && (
        <PlaceSheet
          place={selectedPlace}
          levels={venue.levels}
          warnings={selectedWarnings}
          onDirections={() => openDirections(selectedPlace.id)}
          onImHere={() => {
            positioning.setManual(selectedPlace.levelId, selectedPlace.position)
            setOrigin({ type: 'me' })
            flash(`Location set to ${selectedPlace.name}`)
          }}
          onReport={() => startReport('hazard', { levelId: selectedPlace.levelId, position: selectedPlace.position })}
          onClose={() => {
            setSheet('none')
            setSelectedId(null)
          }}
        />
      )}

      {sheet === 'directions' && (
        <DirectionsSheet
          places={places}
          levels={venue.levels}
          origin={origin}
          destinationId={destinationId}
          stepFree={stepFree}
          route={route}
          problem={problem}
          walking={positioning.mode === 'simulated'}
          walkProgress={positioning.walkProgress}
          onOrigin={setOrigin}
          onDestination={setDestinationId}
          onSwap={() => {
            if (!destinationId) return
            const previous = origin
            setOrigin({ type: 'place', placeId: destinationId })
            setDestinationId(previous.type === 'place' ? previous.placeId : null)
          }}
          onStepFree={setStepFree}
          onSimulate={simulate}
          onStopSimulate={positioning.turnOff}
          onFocusStep={(step) => {
            setLevelId(step.levelId)
            mapRef.current?.focus(step.position)
          }}
          onClose={() => setSheet('none')}
        />
      )}

      {sheet === 'mesh' && (
        <MeshSheet
          node={node}
          levels={venue.levels}
          bluetoothSupported={mesh.bluetoothSupported}
          error={mesh.error}
          onConnectBluetooth={() => void mesh.connectBluetooth()}
          onRename={(name) => {
            mesh.rename(name)
            flash('Callsign saved')
          }}
          onReport={(type) => startReport(type)}
          onShareVenue={() => {
            node.shareVenue(venue)
            flash(`Sharing "${venue.name}" with nearby devices`)
          }}
          onFocus={(lvl, point) => {
            setLevelId(lvl)
            setSheet('none')
            mapRef.current?.focus(point, 12)
          }}
          onClose={() => setSheet('none')}
        />
      )}

      {sheet === 'offline' && (
        <OfflineSheet
          venues={venues}
          activeId={venue.id}
          offlineReady={offlineReady}
          online={online}
          onSelect={(id) => {
            selectVenue(id)
            setSheet('none')
          }}
          onImport={(file) => {
            void file.text().then((text) => {
              try {
                const parsed = parseVenue(text)
                void installVenue(parsed, `Imported "${parsed.name}"`).then(() => selectVenue(parsed.id))
              } catch (e) {
                flash(e instanceof Error ? e.message : 'Invalid venue package')
              }
            })
          }}
          onExport={() => {
            const blob = new Blob([serializeVenue(venue)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${venue.id}.venue.json`
            a.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }}
          onDelete={(id) => {
            void storage.deleteVenue(id)
            setVenues((current) => current.filter((v) => v.id !== id))
            if (id === venue.id) selectVenue(demoVenue.id)
          }}
          onClose={() => setSheet('none')}
        />
      )}

      {report?.position && (
        <div className="dialog-backdrop">
          <form
            className="dialog"
            aria-label={`Report ${annotationStyle[report.type].label}`}
            onSubmit={(e) => {
              e.preventDefault()
              submitReport()
            }}
          >
            <h2>Share {annotationStyle[report.type].label.toLowerCase()}</h2>
            <div className="segmented" role="radiogroup" aria-label="Report type">
              {(['sos', 'closure', 'hazard', 'note'] as AnnotationType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={report.type === type}
                  className={report.type === type ? 'active' : ''}
                  onClick={() => setReport({ ...report, type })}
                >
                  {annotationStyle[type].label}
                </button>
              ))}
            </div>
            <label>
              Details
              <input
                autoFocus
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={report.type === 'sos' ? 'e.g. Injured person, need medic' : 'e.g. Smoke, corridor blocked'}
                maxLength={200}
              />
            </label>
            {(report.type === 'closure' || report.type === 'hazard') && (
              <label>
                Blocked radius: {reportRadius} m
                <input type="range" min={1} max={12} value={reportRadius} onChange={(e) => setReportRadius(Number(e.target.value))} />
              </label>
            )}
            <p className="hint">Sent to every device in range and relayed hop by hop. Routes avoid closures and hazards.</p>
            <div className="action-row end">
              <button type="button" className="secondary-action" onClick={() => setReport(null)}>
                Cancel
              </button>
              <button type="submit" className="primary-action">
                Share
              </button>
            </div>
          </form>
        </div>
      )}

      {report && !report.position && (
        <div className="placing-banner" role="status">
          Tap the map to place the {annotationStyle[report.type].label.toLowerCase()}
          <button type="button" className="link-button" onClick={() => setReport(null)}>
            Cancel
          </button>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Primary">
        {[
          { label: 'Explore', icon: Compass, sheet: 'none' as Sheet },
          { label: 'Directions', icon: CornerUpRight, sheet: 'directions' as Sheet },
          { label: 'Mesh', icon: Radio, sheet: 'mesh' as Sheet },
          { label: 'Offline', icon: HardDriveDownload, sheet: 'offline' as Sheet },
        ].map(({ label, icon: Icon, sheet: target }) => (
          <button
            key={label}
            type="button"
            className={activeNav === label ? 'active' : ''}
            aria-current={activeNav === label ? 'page' : undefined}
            onClick={() => setSheet(target)}
          >
            <span>
              <Icon size={21} strokeWidth={activeNav === label ? 2.5 : 2} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      {(positioning.error || notice) && (
        <div className="toast" role="status">
          {notice ?? positioning.error}
        </div>
      )}
    </main>
  )
}
