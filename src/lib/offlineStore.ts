import { openDB } from 'idb';

export type OfflineRegion = {
  id: string;
  name: string;
  sizeMb: number;
  tileUrl: string;
  bbox: [number, number, number, number];
  downloadedAt: string;
  facilityCount: number;
};

const DB_NAME = 'resilience-maps-offline';
const DB_VERSION = 1;

export const offlineDb = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('regions')) {
      db.createObjectStore('regions', { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains('facilitySnapshots')) {
      db.createObjectStore('facilitySnapshots', { keyPath: 'id' });
    }
  }
});

export async function listOfflineRegions(): Promise<OfflineRegion[]> {
  const db = await offlineDb;
  return db.getAll('regions');
}

export async function saveOfflineRegion(region: OfflineRegion): Promise<void> {
  const db = await offlineDb;
  await db.put('regions', region);
}
