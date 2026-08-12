import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Map as MapLibreMap, type ErrorEvent } from 'maplibre-gl';
import { buildStyle, TERRAIN_SOURCE_ID } from '@/lib/mapStyles';
import { basemapAvailability, registerPmtilesProtocol } from '@/lib/pmtiles';
import { useMapPrefs } from '@/state/mapPrefs';
import { MapContext, type MapContextValue } from '@/components/map/MapContext';

interface MapCanvasProps {
  children?: ReactNode;
  /** Extra bottom padding so sheets do not cover the map centre. */
  bottomPadding?: number;
  interactive?: boolean;
  className?: string;
}

/**
 * Owns the single MapLibre instance.
 *
 * The style is rebuilt (not patched) when the basemap or hillshade preference
 * changes, because switching between vector and raster sources swaps the whole
 * source set. Camera position is preserved across those rebuilds.
 */
export function MapCanvas({
  children,
  bottomPadding = 0,
  interactive = true,
  className,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // The instance also lives in state so the context value can be built during
  // render without reading a ref; it is published from the map's own load event.
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [availability, setAvailability] = useState({
    vector: false,
    terrain: false,
    probed: false,
  });

  const basemap = useMapPrefs((state) => state.basemap);
  const hillshade = useMapPrefs((state) => state.layers.hillshade);
  const setCamera = useMapPrefs((state) => state.setCamera);
  const [initialCamera] = useState(() => {
    const { center, zoom } = useMapPrefs.getState();
    return { center, zoom };
  });

  useEffect(() => {
    registerPmtilesProtocol();
    let cancelled = false;
    void basemapAvailability().then(({ basemap: base, terrain }) => {
      if (cancelled) return;
      setAvailability({ vector: base.available, terrain: terrain.available, probed: true });
      if (!base.available) {
        console.info(
          '[map] no PMTiles archive at the configured URL — using the raster fallback basemap.',
          base.error,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!container.current || !availability.probed || mapRef.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: buildStyle({
        basemap,
        vectorAvailable: availability.vector,
        terrainAvailable: availability.terrain,
        hillshade,
      }),
      center: initialCamera.center,
      zoom: initialCamera.zoom,
      minZoom: 3,
      maxZoom: 19,
      attributionControl: { compact: true },
      interactive,
      // Keeps the compass out of the way of the floating chrome.
      pitchWithRotate: false,
      dragRotate: false,
    });

    mapRef.current = instance;

    instance.on('load', () => setMap(instance));
    instance.on('moveend', () => {
      const center = instance.getCenter();
      setCamera([center.lng, center.lat], instance.getZoom());
    });
    instance.on('error', (event: ErrorEvent) => {
      // Missing tiles at an archive edge are expected; do not spam the console.
      const message = event.error?.message ?? '';
      if (/404|Not Found|does not exist/i.test(message)) return;
      console.warn('[map]', message || event.error);
    });

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
    // Style-affecting props are applied by the effect below; the map itself is
    // created once, after the archive probe resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.probed]);

  useEffect(() => {
    if (!map) return;
    map.setStyle(
      buildStyle({
        basemap,
        vectorAvailable: availability.vector,
        terrainAvailable: availability.terrain,
        hillshade,
      }),
      { diff: false },
    );
  }, [map, basemap, hillshade, availability.vector, availability.terrain]);

  useEffect(() => {
    if (!map) return;
    map.setPadding({ top: 96, right: 16, bottom: bottomPadding, left: 16 });
  }, [map, bottomPadding]);

  const sampleElevation = useCallback(
    (lng: number, lat: number): number | null => {
      if (!map || !availability.terrain) return null;
      if (!map.getSource(TERRAIN_SOURCE_ID)) return null;
      const elevation = map.queryTerrainElevation({ lng, lat });
      return typeof elevation === 'number' ? elevation : null;
    },
    [map, availability.terrain],
  );

  const value = useMemo<MapContextValue>(
    () => ({
      map,
      ready: map !== null,
      vectorAvailable: availability.vector,
      terrainAvailable: availability.terrain,
      sampleElevation,
    }),
    [map, availability.vector, availability.terrain, sampleElevation],
  );

  return (
    <MapContext.Provider value={value}>
      <div ref={container} className={className ?? 'absolute inset-0'} />
      {children}
    </MapContext.Provider>
  );
}
