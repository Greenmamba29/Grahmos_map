import { distance } from './geometry'
import type { Venue } from './types'
import type { Annotation } from '../mesh/protocol'

export class VenueValidationError extends Error {}

const MAX_ITEMS = 20_000

function isPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number' && Number.isFinite(n))
}

/**
 * Validates an untrusted venue package (file import or mesh share) and
 * returns a normalised copy. Throws {@link VenueValidationError}.
 */
export function parseVenue(input: unknown): Venue {
  const v = (typeof input === 'string' ? JSON.parse(input) : input) as Partial<Venue>
  const fail = (message: string): never => {
    throw new VenueValidationError(message)
  }
  if (!v || typeof v !== 'object') fail('Venue package must be a JSON object')
  if (v.schema !== 'grahmos.venue/1') fail('Unsupported venue schema (expected grahmos.venue/1)')
  if (typeof v.id !== 'string' || !/^[a-z0-9][a-z0-9-_.]{0,80}$/i.test(v.id)) fail('Venue id is missing or invalid')
  if (typeof v.name !== 'string' || !v.name.trim()) fail('Venue name is required')
  for (const key of ['levels', 'spaces', 'amenities', 'nodes', 'edges', 'beacons'] as const) {
    if (!Array.isArray(v[key])) fail(`Venue ${key} must be an array`)
    if (v[key]!.length > MAX_ITEMS) fail(`Venue ${key} exceeds ${MAX_ITEMS} items`)
  }
  if (!v.levels!.length) fail('Venue needs at least one level')

  const levelIds = new Set<string>()
  for (const level of v.levels!) {
    if (typeof level.id !== 'string' || typeof level.name !== 'string' || typeof level.ordinal !== 'number') fail('Invalid level')
    if (!Array.isArray(level.outline) || !level.outline.every(isPoint)) fail(`Level ${level.id} outline is invalid`)
    levelIds.add(level.id)
  }
  const nodeIds = new Set<string>()
  for (const node of v.nodes!) {
    if (typeof node.id !== 'string' || !levelIds.has(node.levelId) || !isPoint(node.position)) fail(`Invalid nav node ${node.id}`)
    nodeIds.add(node.id)
  }
  for (const edge of v.edges!) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) fail(`Edge references unknown node ${edge.from} → ${edge.to}`)
    if (!['walk', 'stairs', 'elevator'].includes(edge.kind)) fail(`Invalid edge kind ${edge.kind}`)
  }
  for (const space of v.spaces!) {
    if (typeof space.id !== 'string' || typeof space.name !== 'string' || !levelIds.has(space.levelId)) fail(`Invalid space ${space.id}`)
    if (!Array.isArray(space.polygon) || space.polygon.length < 3 || !space.polygon.every(isPoint)) fail(`Space ${space.id} polygon is invalid`)
    if (space.entranceNodeId && !nodeIds.has(space.entranceNodeId)) fail(`Space ${space.id} entrance node is unknown`)
  }
  for (const amenity of v.amenities!) {
    if (typeof amenity.id !== 'string' || !levelIds.has(amenity.levelId) || !isPoint(amenity.position)) fail(`Invalid amenity ${amenity.id}`)
  }
  for (const beacon of v.beacons!) {
    if (typeof beacon.id !== 'string' || !levelIds.has(beacon.levelId) || !isPoint(beacon.position) || typeof beacon.txPower !== 'number') {
      fail(`Invalid beacon ${beacon.id}`)
    }
  }
  return {
    schema: 'grahmos.venue/1',
    id: v.id!,
    name: v.name!.slice(0, 120),
    address: typeof v.address === 'string' ? v.address.slice(0, 200) : undefined,
    version: typeof v.version === 'number' ? v.version : 1,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
    anchor: v.anchor,
    levels: v.levels!,
    spaces: v.spaces!,
    amenities: v.amenities!,
    nodes: v.nodes!,
    edges: v.edges!,
    beacons: v.beacons!,
  }
}

export function serializeVenue(venue: Venue) {
  return JSON.stringify(venue)
}

/** Navigation nodes covered by active closures/hazards — the router avoids them. */
export function blockedNodesFor(venue: Venue, annotations: Annotation[]): Set<string> {
  const blocked = new Set<string>()
  for (const a of annotations) {
    if (a.venueId !== venue.id || a.resolved) continue
    if (a.type !== 'closure' && a.type !== 'hazard') continue
    for (const node of venue.nodes) {
      if (node.levelId === a.levelId && distance(node.position, a.position) <= a.radius) blocked.add(node.id)
    }
  }
  return blocked
}
