export const facilityCategories = [
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
] as const

export type FacilityCategory = (typeof facilityCategories)[number]
export type FacilityStatus = 'operational' | 'limited' | 'closed' | 'unknown'

export interface Facility {
  id: string
  name: string
  category: FacilityCategory | 'communications'
  coordinates: [number, number]
  capacity: number | null
  status: FacilityStatus
  address?: string
  phone?: string
  isVerified: boolean
  lastUpdated: string
}

export type MapTheme = 'resilience' | 'terrain' | 'satellite'

export interface LayerPreferences {
  theme: MapTheme
  terrain: boolean
  downloadedRegions: boolean
  categories: Record<FacilityCategory, boolean>
}
