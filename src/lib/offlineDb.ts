import { openDB, type DBSchema } from 'idb'
import type { Facility } from '../types/facilities'

interface ResilienceDb extends DBSchema {
  facilities: {
    key: string
    value: Facility
    indexes: { category: string }
  }
  metadata: {
    key: string
    value: { key: string; value: string; updatedAt: string }
  }
}

const database = openDB<ResilienceDb>('resilience-maps', 1, {
  upgrade(db) {
    const facilities = db.createObjectStore('facilities', { keyPath: 'id' })
    facilities.createIndex('category', 'category')
    db.createObjectStore('metadata', { keyPath: 'key' })
  },
})

export async function readCachedFacilities() {
  return (await database).getAll('facilities')
}

export async function cacheFacilities(facilities: Facility[]) {
  const tx = (await database).transaction(['facilities', 'metadata'], 'readwrite')
  await Promise.all([
    ...facilities.map((facility) => tx.objectStore('facilities').put(facility)),
    tx.objectStore('metadata').put({
      key: 'facilities-sync',
      value: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    tx.done,
  ])
}
