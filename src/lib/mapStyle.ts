import type { StyleSpecification } from 'maplibre-gl';

const pmtilesUrl = import.meta.env.VITE_PMTILES_URL ?? '/tiles/resilience-demo.pmtiles';

export const getDefaultCenter = (): [number, number] => {
  const rawCenter = import.meta.env.VITE_DEFAULT_MAP_CENTER ?? '-122.4194,37.7749';
  const [longitude, latitude] = rawCenter.split(',').map(Number);

  if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
    return [longitude, latitude];
  }

  return [-122.4194, 37.7749];
};

export const getDefaultZoom = (): number => {
  const zoom = Number(import.meta.env.VITE_DEFAULT_MAP_ZOOM ?? 11);
  return Number.isFinite(zoom) ? zoom : 11;
};

export const getMapStyle = (): StyleSpecification => ({
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    resilience: {
      type: 'vector',
      url: `pmtiles://${pmtilesUrl}`,
      attribution: 'OpenStreetMap contributors and local resilience data partners'
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#e7eef6'
      }
    },
    {
      id: 'terrain-contours',
      type: 'line',
      source: 'resilience',
      'source-layer': 'contours',
      minzoom: 9,
      paint: {
        'line-color': '#8aa0b7',
        'line-opacity': 0.38,
        'line-width': 0.8
      }
    },
    {
      id: 'critical-infrastructure',
      type: 'circle',
      source: 'resilience',
      'source-layer': 'infrastructure',
      minzoom: 8,
      paint: {
        'circle-color': '#1A73E8',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 14, 7],
        'circle-opacity': 0.4,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1
      }
    }
  ]
});
