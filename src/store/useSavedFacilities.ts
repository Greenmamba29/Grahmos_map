import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SavedFacilitiesState {
  savedIds: string[];
  toggle: (id: string) => void;
}

export const useSavedFacilities = create<SavedFacilitiesState>()(
  persist(
    (set) => ({
      savedIds: [],
      toggle: (id) =>
        set((state) => ({
          savedIds: state.savedIds.includes(id)
            ? state.savedIds.filter((x) => x !== id)
            : [...state.savedIds, id],
        })),
    }),
    { name: "resilience-maps-saved-facilities" },
  ),
);
