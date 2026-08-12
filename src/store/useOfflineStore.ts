import { create } from "zustand";
import type { OfflineRegion } from "@/data/types";

interface OfflineState {
  isOnline: boolean;
  regions: OfflineRegion[];
  setOnline: (online: boolean) => void;
  addRegion: (region: OfflineRegion) => void;
  removeRegion: (id: string) => void;
  updateRegion: (id: string, patch: Partial<OfflineRegion>) => void;
}

const DEMO_REGIONS: OfflineRegion[] = [
  {
    id: "region-sf-core",
    name: "San Francisco — Core",
    bbox: [-122.5164, 37.7081, -122.3549, 37.8324],
    minZoom: 8,
    maxZoom: 15,
    categories: ["hospital", "shelter", "water", "power", "comms", "school"],
    sizeEstimateMb: 84,
    status: "ready",
    downloadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "region-oakland",
    name: "Oakland Metro",
    bbox: [-122.3477, 37.7025, -122.1092, 37.8586],
    minZoom: 8,
    maxZoom: 14,
    categories: ["hospital", "shelter"],
    sizeEstimateMb: 46,
    status: "stale",
    downloadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
  },
];

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  regions: DEMO_REGIONS,
  setOnline: (online) => set({ isOnline: online }),
  addRegion: (region) =>
    set((state) => ({ regions: [region, ...state.regions] })),
  removeRegion: (id) =>
    set((state) => ({ regions: state.regions.filter((r) => r.id !== id) })),
  updateRegion: (id, patch) =>
    set((state) => ({
      regions: state.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
}));
