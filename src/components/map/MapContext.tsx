import { createContext, useContext } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export interface MapContextValue {
  map: MapLibreMap | null;
  ready: boolean;
  /** False when no PMTiles archive is reachable and the raster fallback is in use. */
  vectorAvailable: boolean;
  terrainAvailable: boolean;
  /** Elevation from the loaded DEM, or null when terrain is unavailable. */
  sampleElevation: (lng: number, lat: number) => number | null;
}

export const MapContext = createContext<MapContextValue>({
  map: null,
  ready: false,
  vectorAvailable: false,
  terrainAvailable: false,
  sampleElevation: () => null,
});

export function useMap(): MapContextValue {
  return useContext(MapContext);
}
