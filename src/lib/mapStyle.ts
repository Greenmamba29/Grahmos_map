import type { StyleSpecification } from 'maplibre-gl';
import { getPmtilesUrl } from './pmtiles';

const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';

export function buildMapStyle(usePmtiles: boolean, satellite: boolean, terrain: boolean): string | StyleSpecification {
  if (!usePmtiles) {
    return DEMO_STYLE;
  }

  const pmtilesUrl = getPmtilesUrl();

  if (satellite) {
    return {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '© Esri',
        },
      },
      layers: [
        {
          id: 'satellite',
          type: 'raster',
          source: 'satellite',
        },
      ],
    };
  }

  return {
    version: 8,
    sources: {
      basemap: {
        type: 'vector',
        url: pmtilesUrl,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f8f4f0' },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        paint: { 'fill-color': '#aad3df' },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        paint: { 'fill-color': '#e8eddb' },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
        },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'building',
        paint: { 'fill-color': '#d9d0c9', 'fill-opacity': 0.7 },
      },
    ],
    ...(terrain
      ? {
          terrain: {
            source: 'basemap',
            exaggeration: 1.5,
          },
        }
      : {}),
  };
}

export function getDefaultCenter(): [number, number] {
  const env = import.meta.env.VITE_MAP_DEFAULT_CENTER ?? '-105.2705,40.0150';
  const [lng, lat] = env.split(',').map(Number);
  return [lng, lat];
}

export function getDefaultZoom(): number {
  return Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM ?? 12);
}
