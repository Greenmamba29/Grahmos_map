export type OfflineRegionStatus =
  | 'queued'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'stale'

export interface OfflineRegion {
  id: string
  name: string
  west: number
  south: number
  east: number
  north: number
  minZoom: number
  maxZoom: number
  sizeBytes: number
  status: OfflineRegionStatus
  updatedAt: string
}
