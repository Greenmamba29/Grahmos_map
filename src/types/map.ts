export const facilityCategories = [
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
] as const

export type FacilityCategory = (typeof facilityCategories)[number]
export type FacilityStatus = 'operational' | 'limited' | 'closed' | 'unknown'
export type BaseLayer = 'terrain' | 'streets' | 'satellite'

export interface Facility {
  id: string
  name: string
  category: FacilityCategory
  status: FacilityStatus
  capacity: number | null
  longitude: number
  latitude: number
  address: string
  lastUpdated: string
}

export type CategoryVisibility = Record<FacilityCategory, boolean>

export interface LayerState {
  baseLayer: BaseLayer
  terrainEnabled: boolean
  offlineRegionsVisible: boolean
  categories: CategoryVisibility
}

export const categoryLabels: Record<FacilityCategory, string> = {
  hospital: 'Hospitals',
  school: 'Schools',
  shelter: 'Shelters',
  water: 'Water',
  power: 'Power',
}
