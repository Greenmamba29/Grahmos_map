import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMapLayers } from '@/hooks/useMapLayers';
import { useMap } from '@/components/map/MapContext';
import type { RoutePlan } from '@/types';

interface RouteLineProps {
  plan: RoutePlan | null;
  /** Point highlighted while scrubbing the elevation profile or hovering a step. */
  marker?: [number, number] | null;
  fitOnChange?: boolean;
}

const SOURCE_ID = 'route';
const MARKER_SOURCE_ID = 'route-marker';

/** The route polyline, its casing, endpoint dots and the scrub marker. */
export function RouteLine({ plan, marker = null, fitOnChange = true }: RouteLineProps) {
  const { map, ready } = useMap();

  useMapLayers(() => {
    if (!map || !plan) return;

    const lineData = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: plan.coordinates },
          properties: {},
        },
      ],
    };

    const endpointData = {
      type: 'FeatureCollection' as const,
      features: [plan.origin, plan.destination].map((point, index) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: point },
        properties: { role: index === 0 ? 'origin' : 'destination' },
      })),
    };

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: lineData });
    }
    if (!map.getSource(`${SOURCE_ID}-endpoints`)) {
      map.addSource(`${SOURCE_ID}-endpoints`, { type: 'geojson', data: endpointData });
    }
    if (!map.getSource(MARKER_SOURCE_ID)) {
      map.addSource(MARKER_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer('route-casing')) {
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1557b0',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 16, 13],
          'line-opacity': 0.9,
        },
      });
    }

    if (!map.getLayer('route-line')) {
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1a73e8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9],
        },
      });
    }

    if (!map.getLayer('route-endpoints')) {
      map.addLayer({
        id: 'route-endpoints',
        type: 'circle',
        source: `${SOURCE_ID}-endpoints`,
        paint: {
          'circle-radius': 6,
          'circle-color': ['case', ['==', ['get', 'role'], 'origin'], '#ffffff', '#1a73e8'],
          'circle-stroke-color': ['case', ['==', ['get', 'role'], 'origin'], '#1a73e8', '#ffffff'],
          'circle-stroke-width': 3,
        },
      });
    }

    if (!map.getLayer('route-scrub')) {
      map.addLayer({
        id: 'route-scrub',
        type: 'circle',
        source: MARKER_SOURCE_ID,
        paint: {
          'circle-radius': 7,
          'circle-color': '#202124',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
    }

    if (fitOnChange && plan.coordinates.length > 1) {
      const lngs = plan.coordinates.map((point) => point[0]);
      const lats = plan.coordinates.map((point) => point[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, duration: 600, maxZoom: 15 },
      );
    }

    return () => {
      for (const layerId of [
        'route-scrub',
        'route-endpoints',
        'route-line',
        'route-casing',
      ]) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      for (const sourceId of [MARKER_SOURCE_ID, `${SOURCE_ID}-endpoints`, SOURCE_ID]) {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    };
  }, [plan]);

  useEffect(() => {
    if (!map || !ready) return;
    const source = map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source?.setData) return;
    void source.setData({
      type: 'FeatureCollection',
      features: marker
        ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: marker }, properties: {} }]
        : [],
    });
  }, [map, ready, marker]);

  return null;
}
