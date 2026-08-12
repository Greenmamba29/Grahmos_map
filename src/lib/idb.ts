import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { OfflineRegion } from '@/types/offline'
import type { Facility } from '@/types/facility'

interface ResilienceDB extends DBSchema {
  offlineRegions: {
    key: string
    value: OfflineRegion
  }
  facilitiesCache: {
    key: string
    value: Facility
    indexes: { 'by-category': string }
  }
}

let dbPromise: Promise<IDBPDatabase<ResilienceDB>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ResilienceDB>('resilience-maps', 1, {
      upgrade(db) {
        db.createObjectStore('offlineRegions', { keyPath: 'id' })
        const facilities = db.createObjectStore('facilitiesCache', {
          keyPath: 'id',
        })
        facilities.createIndex('by-category', 'category')
      },
    })
  }
  return dbPromise
}
