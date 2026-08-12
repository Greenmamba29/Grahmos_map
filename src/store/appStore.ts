import { create } from "zustand";
import type {
  Category,
  Facility,
  Filters,
  MapType,
  OfflineRegion,
  TabId,
} from "../types";
import { CATEGORIES } from "../config";
import { DEMO_REGIONS } from "../data/demoData";
import { putRegion, deleteRegion as idbDeleteRegion, toggleSaved as idbToggleSaved } from "./../data/idb";

export const DEFAULT_FILTERS: Filters = {
  openNow: false,
  verified24h: false,
  hasPower: false,
  hasWater: false,
  accessible: false,
  sortBy: "distance",
  maxDistanceKm: 25,
  minCapacity: 0,
};

interface LayerState {
  mapType: MapType;
  hillshade: boolean;
  contours: boolean;
  showOfflineRegions: boolean;
  categoryVisibility: Record<Category, boolean>;
}

interface AppState {
  tab: TabId;
  setTab: (tab: TabId) => void;

  facilities: Facility[];
  setFacilities: (f: Facility[]) => void;

  /** Chip selection on Explore (null = show everything). */
  activeCategory: Category | null;
  setActiveCategory: (c: Category | null) => void;

  filters: Filters;
  setFilters: (f: Filters) => void;

  layers: LayerState;
  setMapType: (t: MapType) => void;
  toggleLayer: (key: "hillshade" | "contours" | "showOfflineRegions") => void;
  toggleCategoryVisibility: (c: Category) => void;

  selectedFacilityId: string | null;
  selectFacility: (id: string | null) => void;

  /** Facility the Routes screen navigates to. */
  routeTargetId: string | null;
  startRoute: (facilityId: string | null) => void;

  filterSheetOpen: boolean;
  setFilterSheetOpen: (open: boolean) => void;
  layersDrawerOpen: boolean;
  setLayersDrawerOpen: (open: boolean) => void;

  userLocation: { lng: number; lat: number } | null;
  setUserLocation: (loc: { lng: number; lat: number } | null) => void;

  savedIds: string[];
  setSavedIds: (ids: string[]) => void;
  toggleSaved: (facilityId: string) => Promise<void>;

  regions: OfflineRegion[];
  setRegions: (r: OfflineRegion[]) => void;
  addRegion: (r: OfflineRegion) => void;
  updateRegion: (id: string, patch: Partial<OfflineRegion>) => void;
  removeRegion: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  tab: "explore",
  setTab: (tab) => set({ tab }),

  facilities: [],
  setFacilities: (facilities) => set({ facilities }),

  activeCategory: null,
  setActiveCategory: (activeCategory) => set({ activeCategory }),

  filters: DEFAULT_FILTERS,
  setFilters: (filters) => set({ filters }),

  layers: {
    mapType: "default",
    hillshade: false,
    contours: false,
    showOfflineRegions: false,
    categoryVisibility: Object.fromEntries(
      CATEGORIES.map((c) => [c.id, true]),
    ) as Record<Category, boolean>,
  },
  setMapType: (mapType) => set({ layers: { ...get().layers, mapType } }),
  toggleLayer: (key) =>
    set({ layers: { ...get().layers, [key]: !get().layers[key] } }),
  toggleCategoryVisibility: (c) => {
    const layers = get().layers;
    set({
      layers: {
        ...layers,
        categoryVisibility: {
          ...layers.categoryVisibility,
          [c]: !layers.categoryVisibility[c],
        },
      },
    });
  },

  selectedFacilityId: null,
  selectFacility: (selectedFacilityId) => set({ selectedFacilityId }),

  routeTargetId: null,
  startRoute: (routeTargetId) =>
    set({ routeTargetId, tab: "routes", selectedFacilityId: null }),

  filterSheetOpen: false,
  setFilterSheetOpen: (filterSheetOpen) => set({ filterSheetOpen }),
  layersDrawerOpen: false,
  setLayersDrawerOpen: (layersDrawerOpen) => set({ layersDrawerOpen }),

  userLocation: null,
  setUserLocation: (userLocation) => set({ userLocation }),

  savedIds: [],
  setSavedIds: (savedIds) => set({ savedIds }),
  toggleSaved: async (facilityId) => {
    const nowSaved = await idbToggleSaved(facilityId);
    const ids = get().savedIds;
    set({
      savedIds: nowSaved
        ? [...ids, facilityId]
        : ids.filter((id) => id !== facilityId),
    });
  },

  regions: DEMO_REGIONS,
  setRegions: (regions) => set({ regions }),
  addRegion: (r) => {
    set({ regions: [...get().regions, r] });
    void putRegion(r);
  },
  updateRegion: (id, patch) => {
    const regions = get().regions.map((r) =>
      r.id === id ? { ...r, ...patch } : r,
    );
    set({ regions });
    const updated = regions.find((r) => r.id === id);
    if (updated) void putRegion(updated);
  },
  removeRegion: (id) => {
    set({ regions: get().regions.filter((r) => r.id !== id) });
    void idbDeleteRegion(id);
  },
}));
