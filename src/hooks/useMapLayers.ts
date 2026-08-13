import { useEffect } from 'react';
import { useMap } from '@/components/map/MapContext';

/**
 * Runs a layer-setup callback once the map is ready, and again after every style
 * swap. `setStyle` discards layers added at runtime, so anything drawn on top of
 * the basemap (routes, hazards, region outlines) has to be re-applied when the
 * responder switches between the default, terrain and satellite basemaps.
 */
export function useMapLayers(setup: () => void | (() => void), deps: unknown[] = []): void {
  const { map, ready } = useMap();

  useEffect(() => {
    if (!map || !ready) return;

    let cleanup: void | (() => void);
    const run = () => {
      if (!map.isStyleLoaded()) return;
      cleanup?.();
      cleanup = setup();
    };

    run();
    // `style.load` fires after setStyle finishes. `styledata` fires continuously
    // during tile load and would tear the overlay layers down and back up.
    map.on('style.load', run);
    return () => {
      map.off('style.load', run);
      cleanup?.();
    };
    // The caller declares its own dependencies; `setup` is intentionally not one
    // of them so an inline closure does not re-register the listener every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, ...deps]);
}
