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

    // `load` waits for every tile in the style. OSM (and a missing PMTiles
    // archive) can stall that forever, which would leave pins, routes and
    // hazards unmounted. `style.load` is enough: the style is ready to accept
    // overlay sources even if the basemap is still fetching.
    const publish = () => {
      if (mapRef.current === instance) setMap(instance);
    };
    if (instance.isStyleLoaded()) {
      publish();
    } else {
      instance.once('style.load', publish);
    }
    const fallback = window.setTimeout(publish, 2000);

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

    const resize = () => instance.resize();
    const frame = requestAnimationFrame(resize);
    const observer =
      container.current && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null;
    observer?.observe(container.current!);

    return () => {
      window.clearTimeout(fallback);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
    // Style-affecting props are applied by the effect below; the map itself is
    // created once, after the archive probe resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.probed]);

  const appliedStyle = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    const signature = `${basemap}|${hillshade}|${availability.vector}|${availability.terrain}`;
    // The map is constructed with this style already; skip the first pass so we
    // do not immediately tear it down (and the overlay layers with it).
    if (appliedStyle.current === null) {
      appliedStyle.current = signature;
      return;
    }
    if (appliedStyle.current === signature) return;
    appliedStyle.current = signature;
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
