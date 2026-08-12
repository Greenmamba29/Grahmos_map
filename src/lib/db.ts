import { openDB, type DBSchema } from 'idb'
import type { Facility } from '../types/map'

interface ResilienceDatabase extends DBSchema {
  facilities: {
    key: string
    value: Facility
    indexes: { category: Facility['category'] }
  }
  metadata: {
    key: string
    value: { key: string; updatedAt: string }
  }
}

const database = openDB<ResilienceDatabase>('resilience-maps', 1, {
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
  const db = await database
  const transaction = db.transaction(['facilities', 'metadata'], 'readwrite')
  await transaction.objectStore('facilities').clear()
  await Promise.all(
    facilities.map((facility) =>
      transaction.objectStore('facilities').put(facility),
    ),
  )
  await transaction.objectStore('metadata').put({
    key: 'facilities',
    updatedAt: new Date().toISOString(),
  })
  await transaction.done
}
