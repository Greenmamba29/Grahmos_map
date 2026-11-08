import { centroid, rect } from './geometry'
import type {
  Amenity,
  Beacon,
  Level,
  NavEdge,
  NavNode,
  Point,
  Space,
  SpaceCategory,
  Venue,
} from './types'

/**
 * Built-in demonstration venue: a three-level civic resilience center.
 * Generated procedurally so the floor plans, navigation graph and beacon
 * layout always stay consistent with each other.
 */

const WIDTH = 84
const DEPTH = 50
const CORRIDOR_TOP = 22
const CORRIDOR_BOTTOM = 28
const CORRIDOR_Y = 25
const BEACON_UUID = 'f7826da6-4fa2-4e98-8024-bc5b71e0893e'

interface SlotSpec {
  width: number
  name: string
  category: SpaceCategory
  keywords?: string[]
}

interface LevelSpec {
  id: string
  name: string
  shortName: string
  ordinal: number
  north: SlotSpec[]
  south: SlotSpec[]
}

const stairsW: SlotSpec = { width: 8, name: 'West Stairs', category: 'stairs' }
const stairsE: SlotSpec = { width: 8, name: 'East Stairs', category: 'stairs' }
const elevator: SlotSpec = { width: 6, name: 'Elevator', category: 'elevator', keywords: ['lift'] }
const restrooms: SlotSpec = {
  width: 8,
  name: 'Restrooms',
  category: 'restroom',
  keywords: ['toilet', 'bathroom', 'wc', 'washroom'],
}

const levelSpecs: LevelSpec[] = [
  {
    id: 'L1',
    name: 'Ground Level',
    shortName: '1',
    ordinal: 0,
    north: [
      stairsW,
      { width: 14, name: 'First Aid Station', category: 'medical', keywords: ['medic', 'nurse', 'triage'] },
      { width: 14, name: 'Community Kitchen', category: 'food', keywords: ['meals', 'food bank'] },
      elevator,
      restrooms,
      { width: 14, name: 'Supply Depot', category: 'utility', keywords: ['water', 'blankets', 'supplies'] },
      { width: 12, name: 'Charging Lounge', category: 'room', keywords: ['power', 'phone charging'] },
      stairsE,
    ],
    south: [
      { width: 16, name: 'Cafe Meridian', category: 'food', keywords: ['coffee', 'eat'] },
      { width: 14, name: 'Market Hall', category: 'retail', keywords: ['shop', 'store'] },
      { width: 24, name: 'Main Lobby', category: 'lobby', keywords: ['entrance', 'reception'] },
      { width: 14, name: 'Visitor Center', category: 'office', keywords: ['help', 'information'] },
      { width: 16, name: 'Shelter Hall A', category: 'shelter', keywords: ['cots', 'sleep', 'refuge'] },
    ],
  },
  {
    id: 'L2',
    name: 'Level 2',
    shortName: '2',
    ordinal: 1,
    north: [
      stairsW,
      { width: 14, name: 'Conference Room Atlas', category: 'conference', keywords: ['meeting'] },
      { width: 14, name: 'Conference Room Borealis', category: 'conference', keywords: ['meeting'] },
      elevator,
      restrooms,
      { width: 14, name: 'Library', category: 'room', keywords: ['books', 'study'] },
      { width: 12, name: 'Quiet Room', category: 'room', keywords: ['prayer', 'rest'] },
      stairsE,
    ],
    south: [
      { width: 16, name: 'Co-working Studio', category: 'office', keywords: ['desks'] },
      { width: 14, name: 'Training Room', category: 'conference', keywords: ['classroom'] },
      { width: 24, name: 'Atrium Overlook', category: 'lobby' },
      { width: 14, name: 'Clinic', category: 'medical', keywords: ['doctor', 'health'] },
      { width: 16, name: 'Family Shelter B', category: 'shelter', keywords: ['cots', 'children'] },
    ],
  },
  {
    id: 'L3',
    name: 'Level 3',
    shortName: '3',
    ordinal: 2,
    north: [
      stairsW,
      { width: 14, name: 'Emergency Operations Center', category: 'security', keywords: ['eoc', 'command'] },
      { width: 14, name: 'Radio & Comms', category: 'utility', keywords: ['ham', 'radio', 'mesh'] },
      elevator,
      restrooms,
      { width: 14, name: 'Server Room', category: 'utility', keywords: ['it', 'network'] },
      { width: 12, name: 'Planning Office', category: 'office' },
      stairsE,
    ],
    south: [
      { width: 16, name: 'Executive Suite', category: 'office' },
      { width: 14, name: 'Board Room', category: 'conference', keywords: ['meeting'] },
      { width: 24, name: 'Roof Garden Access', category: 'lobby', keywords: ['outside', 'garden'] },
      { width: 14, name: 'Records Archive', category: 'room', keywords: ['documents'] },
      { width: 16, name: 'Staff Lounge', category: 'food', keywords: ['break room', 'coffee'] },
    ],
  },
]

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function createDemoVenue(): Venue {
  const levels: Level[] = []
  const spaces: Space[] = []
  const amenities: Amenity[] = []
  const nodes: NavNode[] = []
  const edges: NavEdge[] = []
  const beacons: Beacon[] = []
  /** Vertical connector nodes keyed by slot name, per level. */
  const connectors = new Map<string, NavNode[]>()

  for (const spec of levelSpecs) {
    const levelId = spec.id
    levels.push({
      id: levelId,
      name: spec.name,
      shortName: spec.shortName,
      ordinal: spec.ordinal,
      outline: rect(0, 0, WIDTH, DEPTH),
    })

    spaces.push({
      id: `${levelId}-corridor`,
      levelId,
      name: 'Main Corridor',
      category: 'corridor',
      polygon: rect(0, CORRIDOR_TOP, WIDTH, CORRIDOR_BOTTOM - CORRIDOR_TOP),
      accessible: true,
    })

    const corridorXs = new Set<number>([2, WIDTH - 2])
    const doorLinks: { door: NavNode; x: number }[] = []

    const addRow = (slots: SlotSpec[], side: 'north' | 'south') => {
      let x = 0
      for (const slot of slots) {
        const y = side === 'north' ? 0 : CORRIDOR_BOTTOM
        const h = side === 'north' ? CORRIDOR_TOP : DEPTH - CORRIDOR_BOTTOM
        const polygon = rect(x, y, slot.width, h)
        const id = `${levelId}-${slug(slot.name)}`
        const center = centroid(polygon)
        const kind =
          slot.category === 'stairs'
            ? 'stairs'
            : slot.category === 'elevator'
              ? 'elevator'
              : 'room'
        const roomNode: NavNode = { id: `${id}:node`, levelId, position: center, kind }
        const doorX = Math.round(center[0])
        const door: NavNode = {
          id: `${id}:door`,
          levelId,
          position: [doorX, side === 'north' ? CORRIDOR_TOP : CORRIDOR_BOTTOM],
          kind: 'door',
        }
        nodes.push(roomNode, door)
        edges.push({ from: roomNode.id, to: door.id, kind: 'walk' })
        corridorXs.add(doorX)
        doorLinks.push({ door, x: doorX })
        spaces.push({
          id,
          levelId,
          name: slot.name,
          category: slot.category,
          polygon,
          entranceNodeId: roomNode.id,
          keywords: slot.keywords,
          accessible: slot.category !== 'stairs',
        })
        if (kind !== 'room') {
          const list = connectors.get(slot.name) ?? []
          list.push(roomNode)
          connectors.set(slot.name, list)
        }
        x += slot.width
      }
    }
    addRow(spec.north, 'north')
    addRow(spec.south, 'south')

    const corridorNodes = [...corridorXs]
      .sort((a, b) => a - b)
      .map<NavNode>((cx) => ({
        id: `${levelId}:corridor:${cx}`,
        levelId,
        position: [cx, CORRIDOR_Y],
        kind: 'corridor',
      }))
    nodes.push(...corridorNodes)
    for (let i = 1; i < corridorNodes.length; i++) {
      edges.push({ from: corridorNodes[i - 1].id, to: corridorNodes[i].id, kind: 'walk' })
    }
    for (const { door, x } of doorLinks) {
      edges.push({ from: door.id, to: `${levelId}:corridor:${x}`, kind: 'walk' })
    }

    const elevatorSpace = spaces.find((s) => s.levelId === levelId && s.category === 'elevator')!
    const restroomSpace = spaces.find((s) => s.levelId === levelId && s.category === 'restroom')!
    const elevatorX = Math.round(centroid(elevatorSpace.polygon)[0])
    const restroomX = Math.round(centroid(restroomSpace.polygon)[0])
    amenities.push(
      {
        id: `${levelId}-aed`,
        levelId,
        name: `AED · ${spec.name}`,
        category: 'aed',
        position: [elevatorX - 2, CORRIDOR_TOP + 1],
        nodeId: `${levelId}:corridor:${elevatorX}`,
        keywords: ['defibrillator', 'heart', 'cardiac'],
      },
      {
        id: `${levelId}-extinguisher`,
        levelId,
        name: `Fire extinguisher · ${spec.name}`,
        category: 'fire-extinguisher',
        position: [restroomX + 3, CORRIDOR_BOTTOM - 1],
        nodeId: `${levelId}:corridor:${restroomX}`,
        keywords: ['fire'],
      },
      {
        id: `${levelId}-water`,
        levelId,
        name: `Water refill · ${spec.name}`,
        category: 'water',
        position: [restroomX - 2, CORRIDOR_TOP + 1],
        nodeId: `${levelId}:corridor:${restroomX}`,
        keywords: ['drink', 'fountain'],
      },
    )

    if (spec.ordinal === 0) {
      const westExit: NavNode = { id: `${levelId}:exit:west`, levelId, position: [0, CORRIDOR_Y], kind: 'exit' }
      const eastExit: NavNode = { id: `${levelId}:exit:east`, levelId, position: [WIDTH, CORRIDOR_Y], kind: 'exit' }
      const lobby = spaces.find((s) => s.id === `${levelId}-main-lobby`)!
      const lobbyX = centroid(lobby.polygon)[0]
      const southExit: NavNode = { id: `${levelId}:exit:south`, levelId, position: [lobbyX, DEPTH], kind: 'exit' }
      nodes.push(westExit, eastExit, southExit)
      edges.push(
        { from: westExit.id, to: corridorNodes[0].id, kind: 'walk' },
        { from: eastExit.id, to: corridorNodes[corridorNodes.length - 1].id, kind: 'walk' },
        { from: southExit.id, to: lobby.entranceNodeId!, kind: 'walk' },
      )
      amenities.push(
        { id: 'exit-west', levelId, name: 'West Exit', category: 'exit', position: westExit.position, nodeId: westExit.id, keywords: ['way out', 'emergency exit'] },
        { id: 'exit-east', levelId, name: 'East Exit', category: 'exit', position: eastExit.position, nodeId: eastExit.id, keywords: ['way out', 'emergency exit'] },
        { id: 'exit-main', levelId, name: 'Main Entrance', category: 'exit', position: southExit.position, nodeId: southExit.id, keywords: ['way out', 'front door'] },
        { id: 'info-desk', levelId, name: 'Information Desk', category: 'information', position: [lobbyX, 36], nodeId: lobby.entranceNodeId, keywords: ['help', 'reception'] },
        { id: 'charging-bank', levelId, name: 'Solar charging bank', category: 'charging', position: [74, 8], nodeId: `${levelId}-charging-lounge:node`, keywords: ['power', 'battery'] },
      )
    } else {
      const firstAid = spaces.find((s) => s.levelId === levelId && s.category === 'medical')
      if (firstAid) {
        amenities.push({
          id: `${levelId}-first-aid`,
          levelId,
          name: `First aid kit · ${spec.name}`,
          category: 'first-aid',
          position: centroid(firstAid.polygon),
          nodeId: firstAid.entranceNodeId,
          keywords: ['bandage', 'medical'],
        })
      }
    }

    const beaconSpots: Point[] = [
      [6, CORRIDOR_Y], [22, CORRIDOR_Y], [42, CORRIDOR_Y], [62, CORRIDOR_Y], [78, CORRIDOR_Y],
      [18, 11], [54, 11], [8, 39], [42, 39], [76, 39],
    ]
    beaconSpots.forEach((position, index) => {
      beacons.push({
        id: `${levelId}-b${index + 1}`,
        levelId,
        position,
        txPower: -59,
        ibeacon: { uuid: BEACON_UUID, major: spec.ordinal + 1, minor: index + 1 },
      })
    })
  }

  // Vertical connectors between adjacent levels.
  for (const [name, list] of connectors) {
    const sorted = [...list].sort(
      (a, b) =>
        levels.find((l) => l.id === a.levelId)!.ordinal -
        levels.find((l) => l.id === b.levelId)!.ordinal,
    )
    for (let i = 1; i < sorted.length; i++) {
      const isElevator = name === 'Elevator'
      edges.push({
        from: sorted[i - 1].id,
        to: sorted[i].id,
        kind: isElevator ? 'elevator' : 'stairs',
        seconds: isElevator ? 35 : 22,
      })
    }
  }

  return {
    schema: 'grahmos.venue/1',
    id: 'grahmos-civic-center',
    name: 'GrahmOS Civic Resilience Center',
    address: 'Demonstration venue · works fully offline',
    version: 1,
    updatedAt: '2026-11-01T00:00:00.000Z',
    anchor: { lng: -122.4194, lat: 37.7749, bearing: 0 },
    levels,
    spaces,
    amenities,
    nodes,
    edges,
    beacons,
  }
}

export const DEMO_BEACON_UUID = BEACON_UUID
