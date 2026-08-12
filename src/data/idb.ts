import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Facility, FacilityReport, OfflineRegion } from "../types";

interface ResilienceDB extends DBSchema {
  facilities: { key: string; value: Facility };
  regions: { key: string; value: OfflineRegion };
  saved: { key: string; value: { facilityId: string; savedAt: string } };
  /** Status reports created offline, flushed to Supabase on reconnect. */
  outbox: { key: string; value: FacilityReport };
}

let dbPromise: Promise<IDBPDatabase<ResilienceDB>> | null = null;

export function getDB() {
  dbPromise ??= openDB<ResilienceDB>("resilience-maps", 1, {
    upgrade(db) {
      db.createObjectStore("facilities", { keyPath: "id" });
      db.createObjectStore("regions", { keyPath: "id" });
      db.createObjectStore("saved", { keyPath: "facilityId" });
      db.createObjectStore("outbox", { keyPath: "id" });
    },
  });
  return dbPromise;
}

export async function snapshotFacilities(facilities: Facility[]) {
  const db = await getDB();
  const tx = db.transaction("facilities", "readwrite");
  await Promise.all(facilities.map((f) => tx.store.put(f)));
  await tx.done;
}

export async function readFacilities(): Promise<Facility[]> {
  const db = await getDB();
  return db.getAll("facilities");
}

export async function readRegions(): Promise<OfflineRegion[]> {
  const db = await getDB();
  return db.getAll("regions");
}

export async function putRegion(region: OfflineRegion) {
  const db = await getDB();
  await db.put("regions", region);
}

export async function deleteRegion(id: string) {
  const db = await getDB();
  await db.delete("regions", id);
}

export async function queueReport(report: FacilityReport) {
  const db = await getDB();
  await db.put("outbox", report);
}

export async function drainOutbox(): Promise<FacilityReport[]> {
  const db = await getDB();
  const all = await db.getAll("outbox");
  const tx = db.transaction("outbox", "readwrite");
  await tx.store.clear();
  await tx.done;
  return all;
}

export async function toggleSaved(facilityId: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get("saved", facilityId);
  if (existing) {
    await db.delete("saved", facilityId);
    return false;
  }
  await db.put("saved", { facilityId, savedAt: new Date().toISOString() });
  return true;
}

export async function readSavedIds(): Promise<string[]> {
  const db = await getDB();
  return (await db.getAll("saved")).map((s) => s.facilityId);
}
