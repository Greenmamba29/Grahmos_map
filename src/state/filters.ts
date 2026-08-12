import { create } from 'zustand';
import type { FacilityCategory, FilterState, SortKey } from '@/types';

export const CAPACITY_BOUNDS: [number, number] = [0, 2500];
export const DISTANCE_BOUNDS: [number, number] = [1, 50];

const initialFilters: FilterState = {
  categories: [],
  openNow: false,
  verifiedRecently: false,
  hasGenerator: false,
  hasWater: false,
  sortBy: 'distance',
  capacityRange: [...CAPACITY_BOUNDS],
  maxDistanceKm: DISTANCE_BOUNDS[1],
};

interface FiltersStore extends FilterState {
  toggleCategory: (category: FacilityCategory) => void;
  setCategories: (categories: FacilityCategory[]) => void;
  togglePill: (key: 'openNow' | 'verifiedRecently' | 'hasGenerator' | 'hasWater') => void;
  setSortBy: (sortBy: SortKey) => void;
  setCapacityRange: (range: [number, number]) => void;
  setMaxDistanceKm: (km: number) => void;
  reset: () => void;
  activeCount: () => number;
}

export const useFilters = create<FiltersStore>((set, get) => ({
  ...initialFilters,

  toggleCategory: (category) =>
    set((state) => ({
      categories: state.categories.includes(category)
        ? state.categories.filter((item) => item !== category)
        : [...state.categories, category],
    })),

  setCategories: (categories) => set({ categories }),

  togglePill: (key) => set((state) => ({ [key]: !state[key] }) as Partial<FilterState>),

  setSortBy: (sortBy) => set({ sortBy }),

  setCapacityRange: (capacityRange) => set({ capacityRange }),

  setMaxDistanceKm: (maxDistanceKm) => set({ maxDistanceKm }),

  reset: () => set({ ...initialFilters, capacityRange: [...CAPACITY_BOUNDS] }),

  activeCount: () => {
    const state = get();
    let count = 0;
    if (state.openNow) count += 1;
    if (state.verifiedRecently) count += 1;
    if (state.hasGenerator) count += 1;
    if (state.hasWater) count += 1;
    if (state.sortBy !== 'distance') count += 1;
    if (state.capacityRange[0] !== CAPACITY_BOUNDS[0] || state.capacityRange[1] !== CAPACITY_BOUNDS[1]) {
      count += 1;
    }
    if (state.maxDistanceKm !== DISTANCE_BOUNDS[1]) count += 1;
    return count;
  },
}));
