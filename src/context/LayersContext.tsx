import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { DEFAULT_LAYER_STATE, type MapLayerState } from '@/types/layers';

interface LayersContextValue {
  layers: MapLayerState;
  toggleLayer: (key: keyof MapLayerState) => void;
  setLayer: (key: keyof MapLayerState, value: boolean) => void;
}

const LayersContext = createContext<LayersContextValue | null>(null);

export function LayersProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<MapLayerState>(DEFAULT_LAYER_STATE);

  const toggleLayer = useCallback((key: keyof MapLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setLayer = useCallback((key: keyof MapLayerState, value: boolean) => {
    setLayers((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <LayersContext.Provider value={{ layers, toggleLayer, setLayer }}>
      {children}
    </LayersContext.Provider>
  );
}

export function useLayers() {
  const ctx = useContext(LayersContext);
  if (!ctx) throw new Error('useLayers must be used within LayersProvider');
  return ctx;
}
