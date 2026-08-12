export type FacilityCategory =
  | 'hospital'
  | 'school'
  | 'shelter'
  | 'water'
  | 'power'
  | 'comms'

export type FacilityStatus = 'open' | 'limited' | 'closed' | 'unknown'

export interface Facility {
  id: string
  name: string
  category: FacilityCategory
  status: FacilityStatus
  capacity: number | null
  capacityUnit: string | null
  phone: string | null
  website: string | null
  address: string | null
  resources: string[]
  notes: string | null
  lng: number
  lat: number
  lastUpdated: string
  distanceM?: number
}

export const FACILITY_CATEGORIES: {
  id: FacilityCategory
  label: string
  color: string
}[] = [
  { id: 'hospital', label: 'Hospitals', color: '#E53935' },
  { id: 'school', label: 'Schools', color: '#FB8C00' },
  { id: 'shelter', label: 'Shelters', color: '#1A73E8' },
  { id: 'water', label: 'Water', color: '#00ACC1' },
  { id: 'power', label: 'Power', color: '#F9A825' },
  { id: 'comms', label: 'Comms', color: '#8E24AA' },
]
