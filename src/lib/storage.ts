import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Venue } from '../indoor/types'
import type { SignedEntry } from '../mesh/protocol'

interface GrahmosDb extends DBSchema {
  venues: { key: string; value: Venue }
  annotations: { key: string; value: SignedEntry }
  settings: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<GrahmosDb>> | null = null

function db() {
  if (typeof indexedDB === 'undefined') return null
  dbPromise ??= openDB<GrahmosDb>('grahmos-indoor', 1, {
    upgrade(database) {
      database.createObjectStore('venues', { keyPath: 'id' })
      database.createObjectStore('annotations', { keyPath: 'key' })
      database.createObjectStore('settings')
    },
  })
  return dbPromise
}

async function safe<T>(fallback: T, run: (database: IDBPDatabase<GrahmosDb>) => Promise<T>): Promise<T> {
  const pending = db()
  if (!pending) return fallback
  try {
    return await run(await pending)
  } catch (error) {
    console.warn('[grahmos] storage unavailable', error)
    return fallback
  }
}

export const storage = {
  listVenues: () => safe<Venue[]>([], (d) => d.getAll('venues')),
  saveVenue: (venue: Venue) => safe(undefined, async (d) => void (await d.put('venues', venue))),
  deleteVenue: (id: string) => safe(undefined, (d) => d.delete('venues', id)),
  loadAnnotations: () => safe<SignedEntry[]>([], (d) => d.getAll('annotations')),
  saveAnnotations: (entries: SignedEntry[]) =>
    safe(undefined, async (d) => {
      const tx = d.transaction('annotations', 'readwrite')
      await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done])
    }),
  getSetting: <T>(key: string) => safe<T | undefined>(undefined, async (d) => (await d.get('settings', key)) as T | undefined),
  setSetting: (key: string, value: unknown) => safe(undefined, async (d) => void (await d.put('settings', value, key))),
  /** Asks the browser not to evict offline data under storage pressure. */
  persist: async () => {
    try {
      return (await navigator.storage?.persist?.()) ?? false
    } catch {
      return false
    }
  },
  estimate: async () => {
    try {
      return (await navigator.storage?.estimate?.()) ?? null
    } catch {
      return null
    }
  },
}
