import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AlertItem, Facility, FacilityUpdate, Hazard, OfflineRegion } from '@/types';

const DB_NAME = 'resilience-maps';
const DB_VERSION = 1;

interface CacheMeta {
  key: string;
  fetchedAt: string;
}

interface ResilienceDB extends DBSchema {
  facilities: {
    key: string;
    value: Facility;
    indexes: { 'by-category': string; 'by-status': string };
  };
  hazards: {
    key: string;
    value: Hazard;
  };
  updates: {
    key: string;
    value: FacilityUpdate;
    indexes: { 'by-facility': string };
  };
  outbox: {
    key: string;
    value: FacilityUpdate;
  };
  regions: {
    key: string;
    value: OfflineRegion;
  };
  saved: {
    key: string;
    value: { facilityId: string; savedAt: string; list: string };
  };
  alerts: {
    key: string;
    value: AlertItem;
  };
  meta: {
    key: string;
    value: CacheMeta;
  };
}

let dbPromise: Promise<IDBPDatabase<ResilienceDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ResilienceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ResilienceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('facilities')) {
          const store = db.createObjectStore('facilities', { keyPath: 'id' });
          store.createIndex('by-category', 'category');
          store.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('hazards')) {
          db.createObjectStore('hazards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('updates')) {
          const store = db.createObjectStore('updates', { keyPath: 'id' });
          store.createIndex('by-facility', 'facilityId');
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'clientId' });
        }
        if (!db.objectStoreNames.contains('regions')) {
          db.createObjectStore('regions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('saved')) {
          db.createObjectStore('saved', { keyPath: 'facilityId' });
        }
        if (!db.objectStoreNames.contains('alerts')) {
          db.createObjectStore('alerts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * IndexedDB is unavailable in private browsing on some engines. Every helper
 * degrades to a no-op rather than breaking the screen that called it.
 */
async function safely<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn('[db] operation failed, continuing without persistence', error);
    return fallback;
  }
}

export const facilityCache = {
  async put(facilities: Facility[], fetchedAt = new Date().toISOString()): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      const tx = db.transaction(['facilities', 'meta'], 'readwrite');
      const store = tx.objectStore('facilities');
      await Promise.all(facilities.map((facility) => store.put(facility)));
      await tx.objectStore('meta').put({ key: 'facilities:fetchedAt', fetchedAt });
      await tx.done;
    }, undefined);
  },

  async all(): Promise<Facility[]> {
    return safely(async () => {
      const db = await getDb();
      return db.getAll('facilities');
    }, []);
  },

  async fetchedAt(): Promise<string | undefined> {
    return safely(async () => {
      const db = await getDb();
      const meta = await db.get('meta', 'facilities:fetchedAt');
      return meta?.fetchedAt;
    }, undefined);
  },

  async clear(): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      await db.clear('facilities');
    }, undefined);
  },
};

export const hazardCache = {
  async put(hazards: Hazard[]): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      const tx = db.transaction('hazards', 'readwrite');
      await Promise.all(hazards.map((hazard) => tx.store.put(hazard)));
      await tx.done;
    }, undefined);
  },
  async all(): Promise<Hazard[]> {
    return safely(async () => {
      const db = await getDb();
      return db.getAll('hazards');
    }, []);
  },
};

export const updateStore = {
  async put(updates: FacilityUpdate[]): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      const tx = db.transaction('updates', 'readwrite');
      await Promise.all(updates.map((update) => tx.store.put(update)));
      await tx.done;
    }, undefined);
  },
  async byFacility(facilityId: string): Promise<FacilityUpdate[]> {
    return safely(async () => {
      const db = await getDb();
      return db.getAllFromIndex('updates', 'by-facility', facilityId);
    }, []);
  },
};

export const outboxStore = {
  async add(update: FacilityUpdate): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      await db.put('outbox', { ...update, pending: true });
    }, undefined);
  },
  async all(): Promise<FacilityUpdate[]> {
    return safely(async () => {
      const db = await getDb();
      return db.getAll('outbox');
    }, []);
  },
  async remove(clientId: string): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      await db.delete('outbox', clientId);
    }, undefined);
  },
};

export const regionStore = {
  async put(region: OfflineRegion): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      await db.put('regions', region);
    }, undefined);
  },
  async all(): Promise<OfflineRegion[]> {
    return safely(async () => {
      const db = await getDb();
      return db.getAll('regions');
    }, []);
  },
  async remove(id: string): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      await db.delete('regions', id);
    }, undefined);
  },
};

export const savedStore = {
  async toggle(facilityId: string, list = 'Starred'): Promise<boolean> {
    return safely(async () => {
      const db = await getDb();
      const existing = await db.get('saved', facilityId);
      if (existing) {
        await db.delete('saved', facilityId);
        return false;
      }
      await db.put('saved', { facilityId, savedAt: new Date().toISOString(), list });
      return true;
    }, false);
  },
  async ids(): Promise<string[]> {
    return safely(async () => {
      const db = await getDb();
      const rows = await db.getAll('saved');
      return rows.map((row) => row.facilityId);
    }, []);
  },
};

export const alertStore = {
  async put(alerts: AlertItem[]): Promise<void> {
    await safely(async () => {
      const db = await getDb();
      const tx = db.transaction('alerts', 'readwrite');
      await Promise.all(alerts.map((alert) => tx.store.put(alert)));
      await tx.done;
    }, undefined);
  },
  async all(): Promise<AlertItem[]> {
    return safely(async () => {
      const db = await getDb();
      return db.getAll('alerts');
    }, []);
  },
};

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  if (!('storage' in navigator) || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return { usage: 0, quota: 0 };
  }
}

/** Ask the browser not to evict our tiles when disk pressure rises. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
