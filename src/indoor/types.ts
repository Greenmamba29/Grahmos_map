/**
 * Indoor venue model.
 *
 * The schema is inspired by the open Indoor Mapping Data Format (venue →
 * level → unit/amenity/opening) but stored in local metric coordinates so a
 * venue renders, searches and routes with zero network access. An optional
 * geo anchor lets a venue be placed on a world map when GPS is available.
 *
 * Coordinates: metres, x grows east, y grows south (SVG friendly).
 */

export type Point = [x: number, y: number]

export type SpaceCategory =
  | 'room'
  | 'corridor'
  | 'lobby'
  | 'restroom'
  | 'elevator'
  | 'stairs'
  | 'food'
  | 'medical'
  | 'retail'
  | 'office'
  | 'conference'
  | 'utility'
  | 'security'
  | 'shelter'

export type AmenityCategory =
  | 'exit'
  | 'aed'
  | 'first-aid'
  | 'fire-extinguisher'
  | 'information'
  | 'water'
  | 'charging'
  | 'assembly'

export interface Level {
  id: string
  name: string
  shortName: string
  /** Ordinal: 0 = ground, negative = basement. */
  ordinal: number
  /** Building outline polygon for this level. */
  outline: Point[]
}

export interface Space {
  id: string
  levelId: string
  name: string
  category: SpaceCategory
  polygon: Point[]
  /** Navigation node a route should end at when this space is a destination. */
  entranceNodeId?: string
  keywords?: string[]
  accessible?: boolean
}

export interface Amenity {
  id: string
  levelId: string
  name: string
  category: AmenityCategory
  position: Point
  nodeId?: string
  keywords?: string[]
}

export type NavNodeKind =
  | 'corridor'
  | 'door'
  | 'room'
  | 'elevator'
  | 'stairs'
  | 'exit'

export interface NavNode {
  id: string
  levelId: string
  position: Point
  kind: NavNodeKind
}

export type NavEdgeKind = 'walk' | 'stairs' | 'elevator'

export interface NavEdge {
  from: string
  to: string
  kind: NavEdgeKind
  /** Explicit cost in seconds; walk edges default to length / walking speed. */
  seconds?: number
}

/** A Bluetooth Low Energy positioning beacon installed in the venue. */
export interface Beacon {
  id: string
  levelId: string
  position: Point
  /** Calibrated RSSI at 1 metre (dBm). */
  txPower: number
  ibeacon?: { uuid: string; major: number; minor: number }
  eddystone?: { namespace: string; instance: string }
}

export interface GeoAnchor {
  /** WGS84 coordinate of local (0, 0). */
  lng: number
  lat: number
  /** Clockwise rotation of the local grid relative to north-up, degrees. */
  bearing: number
}

export interface Venue {
  schema: 'grahmos.venue/1'
  id: string
  name: string
  address?: string
  version: number
  updatedAt: string
  anchor?: GeoAnchor
  levels: Level[]
  spaces: Space[]
  amenities: Amenity[]
  nodes: NavNode[]
  edges: NavEdge[]
  beacons: Beacon[]
}

/** A located point inside a venue. */
export interface IndoorPosition {
  levelId: string
  position: Point
  /** 1-sigma horizontal accuracy in metres. */
  accuracy: number
  source: 'ble' | 'manual' | 'simulated' | 'mesh'
  at: number
}
