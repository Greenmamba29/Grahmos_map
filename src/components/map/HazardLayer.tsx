import { useMapLayers } from '@/hooks/useMapLayers';
import { useMap } from '@/components/map/MapContext';
import { hazardColor } from '@/lib/taxonomy';
import type { Hazard } from '@/types';

interface HazardLayerProps {
  hazards: Hazard[];
  visible: boolean;
}

const SOURCE_ID = 'hazards';

/**
 * Hazard zones drawn as metre-radius circles.
 *
 * `circle-radius` is scaled from the hazard's real radius so a zone keeps its
 * ground footprint as the responder zooms, rather than staying a fixed pixel size.
 */
export function HazardLayer({ hazards, visible }: HazardLayerProps) {
  const { map } = useMap();

  useMapLayers(() => {
    if (!map) return;

    const features = hazards.map((hazard) => ({
      type: 'Feature' as const,
      id: hazard.id,
      geometry: { type: 'Point' as const, coordinates: [hazard.lng, hazard.lat] },
      properties: {
        id: hazard.id,
        kind: hazard.kind,
        severity: hazard.severity,
        radiusM: hazard.radiusM,
        color: hazardColor(hazard.severity),
      },
    }));

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });
    }

    if (!map.getLayer('hazard-fill')) {
      map.addLayer({
        id: 'hazard-fill',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          // Metres-to-pixels at the equator: 156543 m/px at z0, halving per zoom.
          'circle-radius': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            8,
            ['/', ['get', 'radiusM'], 611],
            16,
            ['/', ['get', 'radiusM'], 2.4],
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.16,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.6,
        },
      });
    }

    if (!map.getLayer('hazard-core')) {
      map.addLayer({
        id: 'hazard-core',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    }

    for (const layerId of ['hazard-fill', 'hazard-core']) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }

    return () => {
      for (const layerId of ['hazard-core', 'hazard-fill']) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [hazards, visible]);

  return null;
}
