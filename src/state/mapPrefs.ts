import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '@/lib/config';
import type { BasemapId, LayerToggles } from '@/types';

interface MapPrefsState {
  basemap: BasemapId;
  layers: LayerToggles;
  center: [number, number];
  zoom: number;
  setBasemap: (basemap: BasemapId) => void;
  toggleLayer: (key: keyof LayerToggles) => void;
  setCamera: (center: [number, number], zoom: number) => void;
}

export const useMapPrefs = create<MapPrefsState>()(
  persist(
    (set) => ({
      basemap: 'default',
      layers: {
        hillshade: true,
        hazards: true,
        downloadedRegions: false,
        labels: true,
      },
      center: config.defaultCenter,
      zoom: config.defaultZoom,
      setBasemap: (basemap) => set({ basemap }),
      toggleLayer: (key) =>
        set((state) => ({ layers: { ...state.layers, [key]: !state.layers[key] } })),
      setCamera: (center, zoom) => set({ center, zoom }),
    }),
    {
      name: 'resilience-map-prefs',
      // The camera is restored so a cold start offline reopens where the responder left off.
      partialize: (state) => ({
        basemap: state.basemap,
        layers: state.layers,
        center: state.center,
        zoom: state.zoom,
      }),
    },
  ),
);
