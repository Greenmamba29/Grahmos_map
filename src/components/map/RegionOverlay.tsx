import { useMapLayers } from '@/hooks/useMapLayers';
import { useMap } from '@/components/map/MapContext';
import type { OfflineRegion } from '@/types';

interface RegionOverlayProps {
  regions: OfflineRegion[];
  visible: boolean;
}

const SOURCE_ID = 'offline-regions';

/** Outlines of regions already downloaded, toggled from the layers drawer. */
export function RegionOverlay({ regions, visible }: RegionOverlayProps) {
  const { map } = useMap();

  useMapLayers(() => {
    if (!map) return;

    const features = regions.map((region) => {
      const [west, south, east, north] = region.bbox;
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
        properties: {
          name: region.name,
          ready: region.status === 'downloaded' ? 1 : 0,
        },
      };
    });

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });
    }

    if (!map.getLayer('region-fill')) {
      map.addLayer({
        id: 'region-fill',
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#1a73e8',
          'fill-opacity': ['case', ['==', ['get', 'ready'], 1], 0.08, 0.04],
        },
      });
    }

    if (!map.getLayer('region-outline')) {
      map.addLayer({
        id: 'region-outline',
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#1a73e8',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
    }

    for (const layerId of ['region-fill', 'region-outline']) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }

    return () => {
      for (const layerId of ['region-outline', 'region-fill']) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [regions, visible]);

  return null;
}
