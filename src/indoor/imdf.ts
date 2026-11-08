/**
 * IMDF (Indoor Mapping Data Format, OGC Community Standard 20-094) → grahmos.venue/1.
 *
 * Reads an IMDF archive (zip of GeoJSON layers) or the layers themselves, projects WGS84 onto a local
 * metric grid anchored at the venue's south-west corner, maps unit/amenity categories, and GENERATES the
 * navigation graph IMDF doesn't carry:
 *  - a node per unit, a node per opening (door) linked to every unit the door touches;
 *  - inside walkways, door/centroid nodes linked when the straight line between them stays inside;
 *  - stairs/elevator/escalator units on different levels whose centres are within 4 m are linked;
 *  - openings on the building footprint (or categorised as exits) become exit nodes.
 */
import { unzipSync, strFromU8 } from 'fflate'
import { centroid, distance, pointInPolygon } from './geometry'
import type { Amenity, AmenityCategory, Level, NavEdge, NavNode, Point, Space, SpaceCategory, Venue } from './types'
import { parseVenue } from './venuePackage'

type LngLat = [number, number]
interface Feature<G = unknown> {
  id: string
  feature_type?: string
  geometry: G | null
  properties: Record<string, unknown>
}
interface Collection {
  features?: Feature[]
}

export interface ImdfLayers {
  venue?: Collection
  level?: Collection
  unit?: Collection
  opening?: Collection
  amenity?: Collection
  footprint?: Collection
}

export class ImdfImportError extends Error {}

/** Reads an IMDF zip (or a {layer: FeatureCollection} object) into layers. */
export function readImdf(input: Uint8Array | ImdfLayers): ImdfLayers {
  if (!(input instanceof Uint8Array)) return input
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(input)
  } catch {
    throw new ImdfImportError('Not a zip archive')
  }
  const layers: Record<string, Collection> = {}
  for (const [path, bytes] of Object.entries(files)) {
    const m = path.match(/(?:^|\/)([a-z_]+)\.geojson$/)
    if (!m) continue
    try {
      layers[m[1]] = JSON.parse(strFromU8(bytes))
    } catch {
      throw new ImdfImportError(`${path} is not valid JSON`)
    }
  }
  return layers
}

const label = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, string>
    return o.en ?? o['en-US'] ?? Object.values(o)[0] ?? ''
  }
  return ''
}

export function unitCategory(category: string): SpaceCategory | null {
  const c = category.toLowerCase()
  if (['opentobelow', 'nonpublic', 'structure', 'shaft', 'unspecified', 'void'].includes(c)) return null
  if (c === 'walkway' || c === 'corridor' || c === 'ramp') return 'corridor'
  if (c.startsWith('restroom')) return 'restroom'
  if (c === 'elevator') return 'elevator'
  if (c === 'stairs' || c === 'steps' || c === 'escalator' || c === 'movingwalkway') return 'stairs'
  if (['foodservice', 'kitchen', 'dining'].includes(c)) return 'food'
  if (c === 'retail' || c === 'shop') return 'retail'
  if (c === 'office' || c === 'workroom') return 'office'
  if (['conferenceroom', 'classroom', 'auditorium', 'lecturetheater'].includes(c)) return 'conference'
  if (['firstaid', 'healthcare', 'medical', 'physicaltherapy'].includes(c)) return 'medical'
  if (c === 'lobby' || c === 'foyer' || c === 'atrium') return 'lobby'
  if (['security', 'checkin', 'police'].includes(c)) return 'security'
  if (['mechanical', 'storage', 'utility', 'electrical', 'serverroom', 'laundry'].includes(c)) return 'utility'
  if (c === 'shelter' || c === 'refuge') return 'shelter'
  return 'room'
}

export function amenityCategory(category: string): AmenityCategory | null {
  const c = category.toLowerCase()
  if (c === 'defibrillator' || c === 'aed') return 'aed'
  if (c === 'firstaid') return 'first-aid'
  if (c === 'fireextinguisher') return 'fire-extinguisher'
  if (c.startsWith('information') || c === 'informationdesk') return 'information'
  if (c === 'drinkingfountain' || c === 'water') return 'water'
  if (c === 'powerchargingstation' || c === 'chargingstation') return 'charging'
  if (c === 'meetingpoint' || c === 'assemblypoint') return 'assembly'
  if (c === 'emergencyexit' || c === 'exit') return 'exit'
  return null
}

/** Equirectangular projection around an origin: metres east (x) and south (y). Fine at building scale. */
function projector(origin: LngLat) {
  const mLat = 111_320
  const mLng = 111_320 * Math.cos((origin[1] * Math.PI) / 180)
  return (p: LngLat): Point => [(p[0] - origin[0]) * mLng, (origin[1] - p[1]) * mLat]
}

function outerRing(geometry: unknown): LngLat[] | null {
  const g = geometry as { type?: string; coordinates?: unknown }
  if (g?.type === 'Polygon') return (g.coordinates as LngLat[][])[0] ?? null
  if (g?.type === 'MultiPolygon') {
    const polys = g.coordinates as LngLat[][][]
    // Largest outer ring by vertex count is a fine proxy for the main shape.
    return polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0] ?? null
  }
  return null
}

function pointToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0
  return distance(p, [a[0] + t * dx, a[1] + t * dy])
}

function distanceToBoundary(p: Point, polygon: Point[]) {
  let best = Infinity
  for (let i = 0; i < polygon.length; i++) best = Math.min(best, pointToSegment(p, polygon[i], polygon[(i + 1) % polygon.length]))
  return best
}

/** True when the segment a→b stays inside the polygon (sampled every ~0.5 m). */
function segmentInside(a: Point, b: Point, polygon: Point[], doorTolerance = 0.6) {
  const n = Math.max(2, Math.ceil(distance(a, b) / 0.5))
  for (let i = 1; i < n; i++) {
    const p: Point = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]
    if (!pointInPolygon(p, polygon) && distanceToBoundary(p, polygon) > doorTolerance) return false
  }
  return true
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'x'

export function importImdf(input: Uint8Array | ImdfLayers, options: { id?: string; version?: number } = {}): Venue {
  const layers = readImdf(input)
  const levelFeatures = layers.level?.features ?? []
  const unitFeatures = layers.unit?.features ?? []
  if (!levelFeatures.length) throw new ImdfImportError('IMDF archive has no level.geojson features')
  if (!unitFeatures.length) throw new ImdfImportError('IMDF archive has no unit.geojson features')

  // Origin: south-west corner of everything, so local coordinates are positive.
  const allPoints: LngLat[] = []
  for (const f of [...levelFeatures, ...unitFeatures]) allPoints.push(...(outerRing(f.geometry) ?? []))
  if (!allPoints.length) throw new ImdfImportError('IMDF levels/units have no polygon geometry')
  const minLng = Math.min(...allPoints.map((p) => p[0]))
  const maxLat = Math.max(...allPoints.map((p) => p[1]))
  const project = projector([minLng, maxLat])

  const venueFeature = layers.venue?.features?.[0]
  const venueName = label(venueFeature?.properties.name) || 'Imported venue'
  const id = options.id ?? `imdf-${slug(venueName)}`

  const levels: Level[] = levelFeatures
    .map((f) => ({
      id: String(f.id),
      name: label(f.properties.name) || `Level ${f.properties.ordinal ?? ''}`,
      shortName: label(f.properties.short_name) || String(f.properties.ordinal ?? ''),
      ordinal: Number(f.properties.ordinal ?? 0),
      outline: (outerRing(f.geometry) ?? []).map(project),
    }))
    .sort((a, b) => a.ordinal - b.ordinal)
  const levelIds = new Set(levels.map((l) => l.id))

  const spaces: Space[] = []
  const nodes: NavNode[] = []
  const edges: NavEdge[] = []
  for (const f of unitFeatures) {
    const levelId = String(f.properties.level_id ?? '')
    const category = unitCategory(String(f.properties.category ?? 'room'))
    const ring = outerRing(f.geometry)
    if (!category || !ring || !levelIds.has(levelId)) continue
    const polygon = ring.map(project)
    if (polygon.length > 3 && distance(polygon[0], polygon[polygon.length - 1]) < 1e-6) polygon.pop()
    const name = label(f.properties.name) || label(f.properties.alt_name) || category[0].toUpperCase() + category.slice(1)
    const nodeId = `${f.id}:node`
    const kind = category === 'stairs' ? 'stairs' : category === 'elevator' ? 'elevator' : category === 'corridor' ? 'corridor' : 'room'
    nodes.push({ id: nodeId, levelId, position: centroid(polygon), kind })
    spaces.push({ id: String(f.id), levelId, name, category, polygon, entranceNodeId: nodeId, accessible: category !== 'stairs' })
  }

  // Doors: link each opening to every unit whose boundary it lies on.
  const footprints = (layers.footprint?.features ?? []).map((f) => (outerRing(f.geometry) ?? []).map(project)).filter((p) => p.length)
  const exits: { node: NavNode; name: string }[] = []
  const doorsBySpace = new Map<string, NavNode[]>()
  for (const f of layers.opening?.features ?? []) {
    const g = f.geometry as { type?: string; coordinates?: LngLat[] } | null
    const levelId = String(f.properties.level_id ?? '')
    if (g?.type !== 'LineString' || !g.coordinates?.length || !levelIds.has(levelId)) continue
    const line = g.coordinates.map(project)
    const mid: Point = [(line[0][0] + line[line.length - 1][0]) / 2, (line[0][1] + line[line.length - 1][1]) / 2]
    const door: NavNode = { id: `${f.id}:door`, levelId, position: mid, kind: 'door' }
    const touching = spaces.filter((s) => s.levelId === levelId && distanceToBoundary(mid, s.polygon) < 0.75)
    if (!touching.length) continue
    nodes.push(door)
    for (const s of touching) {
      edges.push({ from: door.id, to: s.entranceNodeId!, kind: 'walk' })
      doorsBySpace.set(s.id, [...(doorsBySpace.get(s.id) ?? []), door])
    }
    const category = String(f.properties.category ?? '').toLowerCase()
    const onFootprint = footprints.some((fp) => distanceToBoundary(mid, fp) < 0.75)
    if (category.includes('emergencyexit') || category === 'pedestrian.principal' || (touching.length === 1 && onFootprint)) {
      door.kind = 'exit'
      exits.push({ node: door, name: label(f.properties.name) || (category === 'pedestrian.principal' ? 'Main Entrance' : 'Exit') })
    }
  }

  // Walkways: connect their doors and centre where the straight line stays inside the walkway.
  for (const s of spaces.filter((x) => x.category === 'corridor')) {
    const points = [nodes.find((n) => n.id === s.entranceNodeId)!, ...(doorsBySpace.get(s.id) ?? [])]
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (segmentInside(points[i].position, points[j].position, s.polygon)) edges.push({ from: points[i].id, to: points[j].id, kind: 'walk' })
      }
    }
  }

  // Vertical connectors: same kind, adjacent levels, centres within 4 m.
  const ordinal = new Map(levels.map((l) => [l.id, l.ordinal]))
  const connectors = nodes.filter((n) => n.kind === 'stairs' || n.kind === 'elevator')
  for (const a of connectors) {
    for (const b of connectors) {
      if (a.kind !== b.kind || a.id >= b.id) continue
      const floors = Math.abs((ordinal.get(a.levelId) ?? 0) - (ordinal.get(b.levelId) ?? 0))
      if (floors !== 1 || distance(a.position, b.position) > 4) continue
      edges.push({ from: a.id, to: b.id, kind: a.kind === 'elevator' ? 'elevator' : 'stairs', seconds: a.kind === 'elevator' ? 35 : 22 })
    }
  }

  const amenities: Amenity[] = exits.map(({ node, name }, i) => ({
    id: `exit-${i}`,
    levelId: node.levelId,
    name,
    category: 'exit' as const,
    position: node.position,
    nodeId: node.id,
  }))
  for (const f of layers.amenity?.features ?? []) {
    const g = f.geometry as { type?: string; coordinates?: LngLat } | null
    const category = amenityCategory(String(f.properties.category ?? ''))
    if (g?.type !== 'Point' || !g.coordinates || !category) continue
    const unitIds = (f.properties.unit_ids as string[] | undefined) ?? []
    const unit = spaces.find((s) => unitIds.includes(s.id))
    const position = project(g.coordinates)
    const levelId = unit?.levelId ?? spaces.find((s) => pointInPolygon(position, s.polygon))?.levelId
    if (!levelId) continue
    amenities.push({ id: String(f.id), levelId, name: label(f.properties.name) || category, category, position, nodeId: unit?.entranceNodeId })
  }

  // Validate through the same gate as any other package.
  return parseVenue({
    schema: 'grahmos.venue/1',
    id,
    name: venueName,
    address: label((venueFeature?.properties as Record<string, unknown> | undefined)?.address_id) || undefined,
    version: options.version ?? 1,
    updatedAt: new Date().toISOString(),
    anchor: { lng: minLng, lat: maxLat, bearing: 0 },
    levels,
    spaces,
    amenities,
    nodes,
    edges,
    beacons: [],
  })
}
