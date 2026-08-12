import { create } from "zustand";

export type BaseMapStyle = "streets" | "terrain" | "satellite";

interface AppState {
  selectedFacilityId: string | null;
  isLayersDrawerOpen: boolean;
  baseMapStyle: BaseMapStyle;
  showTerrainOverlay: boolean;
  showOfflineRegionsOverlay: boolean;
  showHazardOverlay: boolean;
  selectFacility: (id: string | null) => void;
  openLayersDrawer: () => void;
  closeLayersDrawer: () => void;
  setBaseMapStyle: (style: BaseMapStyle) => void;
  toggleTerrainOverlay: () => void;
  toggleOfflineRegionsOverlay: () => void;
  toggleHazardOverlay: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedFacilityId: null,
  isLayersDrawerOpen: false,
  baseMapStyle: "streets",
  showTerrainOverlay: false,
  showOfflineRegionsOverlay: false,
  showHazardOverlay: false,
  selectFacility: (id) => set({ selectedFacilityId: id }),
  openLayersDrawer: () => set({ isLayersDrawerOpen: true }),
  closeLayersDrawer: () => set({ isLayersDrawerOpen: false }),
  setBaseMapStyle: (baseMapStyle) => set({ baseMapStyle }),
  toggleTerrainOverlay: () =>
    set((state) => ({ showTerrainOverlay: !state.showTerrainOverlay })),
  toggleOfflineRegionsOverlay: () =>
    set((state) => ({
      showOfflineRegionsOverlay: !state.showOfflineRegionsOverlay,
    })),
  toggleHazardOverlay: () =>
    set((state) => ({ showHazardOverlay: !state.showHazardOverlay })),
}));
