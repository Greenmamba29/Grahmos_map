import type { BBox, Facility, FacilityReport, FacilityStatus } from "../types";
import { supabase } from "./supabaseClient";
import {
  drainOutbox,
  queueReport,
  readFacilities,
  snapshotFacilities,
} from "./idb";
import { DEMO_FACILITIES, DEMO_REPORTS } from "./demoData";

interface FacilityRow {
  id: string;
  name: string;
  category: Facility["category"];
  address: string | null;
  phone: string | null;
  capacity: number | null;
  occupancy: number | null;
  resources: Facility["resources"] | null;
  status: FacilityStatus;
  status_note: string | null;
  last_updated: string;
  verified_by: string | null;
  lng: number;
  lat: number;
}

function fromRow(r: FacilityRow): Facility {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    lng: r.lng,
    lat: r.lat,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    capacity: r.capacity ?? undefined,
    occupancy: r.occupancy ?? undefined,
    resources: r.resources ?? {},
    status: r.status,
    statusNote: r.status_note ?? undefined,
    lastUpdated: r.last_updated,
    verifiedBy: r.verified_by ?? undefined,
  };
}

/**
 * Offline-first read: IndexedDB snapshot first, then a network refresh from
 * Supabase when configured + online. Falls back to the bundled demo data so
 * the app is useful even on a first-ever offline visit.
 */
export async function loadFacilities(): Promise<Facility[]> {
  const cached = await readFacilities().catch(() => [] as Facility[]);

  if (supabase && navigator.onLine) {
    const { data, error } = await supabase.rpc("facilities_with_coords");
    if (!error && data && data.length > 0) {
      const fresh = (data as FacilityRow[]).map(fromRow);
      void snapshotFacilities(fresh);
      return fresh;
    }
  }

  if (cached.length > 0) return cached;
  void snapshotFacilities(DEMO_FACILITIES);
  return DEMO_FACILITIES;
}

export async function loadReports(facilityId: string): Promise<FacilityReport[]> {
  if (supabase && navigator.onLine) {
    const { data, error } = await supabase
      .from("facility_reports")
      .select("*")
      .eq("facility_id", facilityId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      return data.map((r) => ({
        id: r.id,
        facilityId: r.facility_id,
        status: r.status,
        note: r.note ?? undefined,
        reporter: r.reporter ?? undefined,
        createdAt: r.created_at,
      }));
    }
  }
  return DEMO_REPORTS.filter((r) => r.facilityId === facilityId);
}

/** Insert a report; when offline it is queued in the IndexedDB outbox. */
export async function submitReport(
  report: Omit<FacilityReport, "id" | "createdAt">,
): Promise<{ queued: boolean }> {
  const full: FacilityReport = {
    ...report,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (supabase && navigator.onLine) {
    const { error } = await supabase.from("facility_reports").insert({
      facility_id: full.facilityId,
      status: full.status,
      note: full.note,
      reporter: full.reporter,
    });
    if (!error) return { queued: false };
  }
  await queueReport(full);
  return { queued: true };
}

/** Flush queued offline reports; call on `online` events. */
export async function flushOutbox(): Promise<number> {
  if (!supabase || !navigator.onLine) return 0;
  const pending = await drainOutbox();
  let sent = 0;
  for (const r of pending) {
    const { error } = await supabase.from("facility_reports").insert({
      facility_id: r.facilityId,
      status: r.status,
      note: r.note,
      reporter: r.reporter,
    });
    if (!error) sent++;
    else await queueReport(r); // put it back for the next attempt
  }
  return sent;
}

export function facilitiesInBBox(facilities: Facility[], bbox: BBox): Facility[] {
  return facilities.filter(
    (f) =>
      f.lng >= bbox.minLng &&
      f.lng <= bbox.maxLng &&
      f.lat >= bbox.minLat &&
      f.lat <= bbox.maxLat,
  );
}

export function haversineKm(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
