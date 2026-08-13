import type { StyleSpecification } from 'maplibre-gl';
import { config } from '@/lib/config';
import type { BasemapId } from '@/types';

/**
 * Style construction.
 *
 * Styles are built in code rather than loaded from a URL for two reasons: the app
 * must be able to switch basemaps with the network down, and the vector style has
 * to degrade to a raster fallback when no PMTiles archive is present.
 *
 * No layer here depends on glyphs (font PBFs), so the map renders correctly on a
 * device that only has the tile archive. Place labels come from DOM markers
 * instead; see `FacilityMarkers`. To add vector label layers, drop a font pack in
 * `public/fonts/` and point `glyphs` at it.
 */

const PALETTE = {
  land: '#f8f9fa',
  landcover: '#e8f5e9',
  park: '#dcf0dc',
  water: '#aadaff',
  waterway: '#9ecdf5',
  building: '#e6e7e8',
  buildingOutline: '#dbdcde',
  motorway: '#ffffff',
  motorwayCasing: '#e2a03f',
  trunk: '#ffffff',
  trunkCasing: '#f0c078',
  road: '#ffffff',
  roadCasing: '#dfe1e5',
  path: '#e8eaed',
  boundary: '#c8ccd1',
} as const;

const VECTOR_SOURCE = 'basemap';
const TERRAIN_SOURCE = 'terrain-dem';

function vectorSourceUrl(): string {
  return `pmtiles://${config.basemapPmtilesUrl}`;
}

function terrainSourceUrl(): string {
  return `pmtiles://${config.terrainPmtilesUrl}`;
}

interface StyleOptions {
  basemap: BasemapId;
  /** False when no PMTiles archive is reachable: fall back to raster. */
  vectorAvailable: boolean;
  terrainAvailable: boolean;
  hillshade: boolean;
}

export function buildStyle(options: StyleOptions): StyleSpecification {
  const { basemap, vectorAvailable, terrainAvailable, hillshade } = options;

  if (basemap === 'satellite') {
    return rasterStyle(config.satelliteTilesUrl || config.fallbackRasterTilesUrl, {
      attribution: config.satelliteTilesUrl
        ? 'Satellite imagery'
        : '© OpenStreetMap contributors © CARTO',
      terrainAvailable,
      hillshade,
    });
  }

  if (!vectorAvailable) {
    return rasterStyle(config.fallbackRasterTilesUrl, {
      attribution: '© OpenStreetMap contributors © CARTO',
      terrainAvailable,
      hillshade: hillshade && basemap === 'terrain',
    });
  }

  return vectorStyle({
    terrainAvailable,
    hillshade: hillshade && basemap === 'terrain',
    terrain3d: basemap === 'terrain' && terrainAvailable,
  });
}

function terrainSources(terrainAvailable: boolean): StyleSpecification['sources'] {
  if (!terrainAvailable) return {};
  return {
    [TERRAIN_SOURCE]: {
      type: 'raster-dem',
      url: terrainSourceUrl(),
      tileSize: 512,
      encoding: 'mapbox',
    },
  };
}

function hillshadeLayer(): StyleSpecification['layers'][number] {
  return {
    id: 'hillshade',
    type: 'hillshade',
    source: TERRAIN_SOURCE,
    paint: {
      'hillshade-exaggeration': 0.45,
      'hillshade-shadow-color': '#5a6472',
      'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': '#8d9299',
    },
  };
}

function rasterStyle(
  tiles: string,
  opts: { attribution: string; terrainAvailable: boolean; hillshade: boolean },
): StyleSpecification {
  return {
    version: 8,
    name: 'Resilience Raster',
    sources: {
      raster: {
        type: 'raster',
        tiles: [tiles],
        tileSize: 256,
        maxzoom: 19,
        attribution: opts.attribution,
      },
      ...terrainSources(opts.terrainAvailable),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': PALETTE.land } },
      { id: 'raster', type: 'raster', source: 'raster', paint: { 'raster-opacity': 1 } },
      ...(opts.hillshade && opts.terrainAvailable ? [hillshadeLayer()] : []),
    ],
  };
}

function vectorStyle(opts: {
  terrainAvailable: boolean;
  hillshade: boolean;
  terrain3d: boolean;
}): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    name: 'Resilience Vector',
    // Present for downstream customisation; no layer in this style requires glyphs.
    glyphs: '/fonts/{fontstack}/{range}.pbf',
    sources: {
      [VECTOR_SOURCE]: {
        type: 'vector',
        url: vectorSourceUrl(),
        attribution: '© OpenStreetMap contributors',
      },
      ...terrainSources(opts.terrainAvailable),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': PALETTE.land } },
      {
        id: 'landcover',
        type: 'fill',
        source: VECTOR_SOURCE,
        'source-layer': 'landcover',
        paint: { 'fill-color': PALETTE.landcover, 'fill-opacity': 0.6 },
      },
      {
        id: 'park',
        type: 'fill',
        source: VECTOR_SOURCE,
        'source-layer': 'park',
        paint: { 'fill-color': PALETTE.park, 'fill-opacity': 0.7 },
      },
      ...(opts.hillshade && opts.terrainAvailable ? [hillshadeLayer()] : []),
      {
        id: 'water',
        type: 'fill',
        source: VECTOR_SOURCE,
        'source-layer': 'water',
        paint: { 'fill-color': PALETTE.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'waterway',
        paint: {
          'line-color': PALETTE.waterway,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 3],
        },
      },
      {
        id: 'building',
        type: 'fill',
        source: VECTOR_SOURCE,
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': PALETTE.building,
          'fill-outline-color': PALETTE.buildingOutline,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1],
        },
      },
      {
        id: 'road-path',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['path', 'track', 'service']]],
        minzoom: 13,
        paint: {
          'line-color': PALETTE.path,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 6],
        },
      },
      {
        id: 'road-minor-casing',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'tertiary', 'secondary']]],
        paint: {
          'line-color': PALETTE.roadCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 18, 16],
        },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'tertiary', 'secondary']]],
        paint: {
          'line-color': PALETTE.road,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 18, 13],
        },
      },
      {
        id: 'road-trunk-casing',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['trunk', 'primary']]],
        paint: {
          'line-color': PALETTE.trunkCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 18, 20],
        },
      },
      {
        id: 'road-trunk',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['trunk', 'primary']]],
        paint: {
          'line-color': PALETTE.trunk,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.75, 18, 16],
        },
      },
      {
        id: 'road-motorway-casing',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        paint: {
          'line-color': PALETTE.motorwayCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 18, 24],
        },
      },
      {
        id: 'road-motorway',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        paint: {
          'line-color': PALETTE.motorway,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 18, 19],
        },
      },
      {
        id: 'boundary',
        type: 'line',
        source: VECTOR_SOURCE,
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 6],
        paint: {
          'line-color': PALETTE.boundary,
          'line-dasharray': [3, 2],
          'line-width': 1,
        },
      },
    ],
  };

  if (opts.terrain3d && opts.terrainAvailable) {
    style.terrain = { source: TERRAIN_SOURCE, exaggeration: 1.2 };
  }

  return style;
}

export const TERRAIN_SOURCE_ID = TERRAIN_SOURCE;
