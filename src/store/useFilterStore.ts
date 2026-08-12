import { create } from "zustand";
import type { FacilityCategory, FacilityStatus } from "@/data/types";

export type SortBy = "distance" | "capacity" | "lastUpdated";

interface FilterState {
  activeCategories: FacilityCategory[];
  activeStatuses: FacilityStatus[];
  sortBy: SortBy;
  capacityRange: [number, number];
  distanceRangeKm: [number, number];
  isFilterSheetOpen: boolean;
  toggleCategory: (category: FacilityCategory) => void;
  setCategories: (categories: FacilityCategory[]) => void;
  toggleStatus: (status: FacilityStatus) => void;
  setSortBy: (sortBy: SortBy) => void;
  setCapacityRange: (range: [number, number]) => void;
  setDistanceRangeKm: (range: [number, number]) => void;
  openFilterSheet: () => void;
  closeFilterSheet: () => void;
  reset: () => void;
}

const ALL_CATEGORIES: FacilityCategory[] = [
  "hospital",
  "school",
  "shelter",
  "water",
  "power",
  "comms",
];

const defaults = {
  activeCategories: [...ALL_CATEGORIES],
  activeStatuses: ["operational", "limited", "offline", "unknown"] as FacilityStatus[],
  sortBy: "distance" as SortBy,
  capacityRange: [0, 2000] as [number, number],
  distanceRangeKm: [0, 50] as [number, number],
};

export const useFilterStore = create<FilterState>((set) => ({
  ...defaults,
  isFilterSheetOpen: false,
  toggleCategory: (category) =>
    set((state) => ({
      activeCategories: state.activeCategories.includes(category)
        ? state.activeCategories.filter((c) => c !== category)
        : [...state.activeCategories, category],
    })),
  setCategories: (categories) => set({ activeCategories: categories }),
  toggleStatus: (status) =>
    set((state) => ({
      activeStatuses: state.activeStatuses.includes(status)
        ? state.activeStatuses.filter((s) => s !== status)
        : [...state.activeStatuses, status],
    })),
  setSortBy: (sortBy) => set({ sortBy }),
  setCapacityRange: (capacityRange) => set({ capacityRange }),
  setDistanceRangeKm: (distanceRangeKm) => set({ distanceRangeKm }),
  openFilterSheet: () => set({ isFilterSheetOpen: true }),
  closeFilterSheet: () => set({ isFilterSheetOpen: false }),
  reset: () => set({ ...defaults }),
}));
