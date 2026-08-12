import type { LineString } from 'geojson'

export type TravelMode = 'walk' | 'drive' | 'bike' | 'evacuation'

export interface RouteStep {
  id: string
  instruction: string
  distanceM: number
  durationS: number
}

export interface ElevationSample {
  distanceM: number
  elevationM: number
}

export interface RoutePlan {
  id: string
  mode: TravelMode
  distanceM: number
  durationS: number
  geometry: LineString
  steps: RouteStep[]
  elevation: ElevationSample[]
  caution?: string
}
