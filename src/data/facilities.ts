import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { MOCK_FACILITIES } from "./mockFacilities";
import { supabase } from "./supabaseClient";
import type { Facility, FacilityCategory, FacilityStatus, StatusReport } from "./types";

interface ResilienceMapsDb extends DBSchema {
  facilities: {
    key: string;
    value: Facility;
  };
  statusReports: {
    key: string;
    value: StatusReport;
  };
}

interface FacilityRow {
  id: string;
  name: string;
  category: FacilityCategory;
  geom: unknown;
  address: string | null;
  capacity: number | null;
  capacity_unit: string | null;
  occupancy: number | null;
  status: FacilityStatus;
  resources: unknown;
  contact_phone: string | null;
  description: string | null;
  last_updated: string;
}

export interface SubmitStatusReportInput {
  facilityId: string;
  reportedStatus: FacilityStatus;
  note?: string;
}

let dbPromise: Promise<IDBPDatabase<ResilienceMapsDb>> | null = null;

function getDb(): Promise<IDBPDatabase<ResilienceMapsDb>> | null {
  if (typeof indexedDB === "undefined") return null;

  dbPromise ??= openDB<ResilienceMapsDb>("resilience-maps", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("facilities")) {
        db.createObjectStore("facilities", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("statusReports")) {
        db.createObjectStore("statusReports", { keyPath: "id" });
      }
    },
  });
  return dbPromise;
}

function readCoordinates(geom: unknown): [number, number] | null {
  if (typeof geom === "string") {
    try {
      return readCoordinates(JSON.parse(geom) as unknown);
    } catch {
      return null;
    }
  }

  if (!geom || typeof geom !== "object" || !("coordinates" in geom)) return null;
  const coordinates = (geom as { coordinates: unknown }).coordinates;
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    return null;
  }
  return [coordinates[0], coordinates[1]];
}

function rowToFacility(row: FacilityRow): Facility | null {
  const coordinates = readCoordinates(row.geom);
  if (!coordinates) return null;

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    lng: coordinates[0],
    lat: coordinates[1],
    address: row.address ?? undefined,
    capacity: row.capacity ?? undefined,
    capacityUnit: row.capacity_unit ?? undefined,
    occupancy: row.occupancy ?? undefined,
    status: row.status,
    resources: Array.isArray(row.resources)
      ? row.resources.filter((resource): resource is string => typeof resource === "string")
      : [],
    contactPhone: row.contact_phone ?? undefined,
    description: row.description ?? undefined,
    lastUpdated: row.last_updated,
  };
}

async function readCachedFacilities(): Promise<Facility[]> {
  try {
    const db = await getDb();
    return db ? await db.getAll("facilities") : [];
  } catch {
    return [];
  }
}

async function cacheFacilities(facilities: Facility[]): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const transaction = db.transaction("facilities", "readwrite");
    await transaction.store.clear();
    await Promise.all(facilities.map((facility) => transaction.store.put(facility)));
    await transaction.done;
  } catch {
    // The bundled fixture remains available if browser storage is unavailable.
  }
}

export async function fetchFacilities(): Promise<Facility[]> {
  if (supabase && (typeof navigator === "undefined" || navigator.onLine)) {
    try {
      const { data, error } = await supabase
        .from("facilities")
        .select(
          "id,name,category,geom,address,capacity,capacity_unit,occupancy,status,resources,contact_phone,description,last_updated",
        );

      if (!error && data) {
        const facilities = (data as FacilityRow[])
          .map(rowToFacility)
          .filter((facility): facility is Facility => facility !== null);
        if (facilities.length > 0) {
          await cacheFacilities(facilities);
          return facilities;
        }
      }
    } catch {
      // Fall through to the last cached response while offline or degraded.
    }
  }

  const cached = await readCachedFacilities();
  return cached.length > 0 ? cached : MOCK_FACILITIES;
}

function createReport(input: SubmitStatusReportInput): StatusReport {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
}

async function queueStatusReport(report: StatusReport): Promise<void> {
  const db = await getDb();
  if (db) await db.put("statusReports", report);
}

export async function submitStatusReport(
  input: SubmitStatusReportInput,
): Promise<{ synced: boolean }> {
  if (supabase && (typeof navigator === "undefined" || navigator.onLine)) {
    try {
      const { error } = await supabase.from("status_reports").insert({
        facility_id: input.facilityId,
        reported_status: input.reportedStatus,
        note: input.note,
        synced_at: new Date().toISOString(),
      });
      if (!error) return { synced: true };
    } catch {
      // Queue below so a failed request does not lose the user's report.
    }
  }

  await queueStatusReport(createReport(input));
  return { synced: false };
}

export async function getQueuedStatusReports(): Promise<StatusReport[]> {
  try {
    const db = await getDb();
    return db ? await db.getAll("statusReports") : [];
  } catch {
    return [];
  }
}
