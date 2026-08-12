import type { StyleSpecification } from 'maplibre-gl'
import type { BaseLayer } from '../types/map'

const mapArchive = import.meta.env.VITE_MAP_PM_TILES_URL as string | undefined
const satelliteArchive = import.meta.env
  .VITE_SATELLITE_PM_TILES_URL as string | undefined
export const terrainArchive = import.meta.env
  .VITE_TERRAIN_PM_TILES_URL as string | undefined

const pmtilesUrl = (url: string) =>
  url.startsWith('pmtiles://') ? url : `pmtiles://${url}`

const vectorLayers: StyleSpecification['layers'] = [
  {
    id: 'earth',
    type: 'fill',
    source: 'resilience',
    'source-layer': 'earth',
    paint: { 'fill-color': '#e8ecdf' },
  },
  {
    id: 'landuse',
    type: 'fill',
    source: 'resilience',
    'source-layer': 'landuse',
    paint: {
      'fill-color': [
        'match',
        ['get', 'kind'],
        'park',
        '#cfe3c4',
        'forest',
        '#c7ddbc',
        '#e8ecdf',
      ],
      'fill-opacity': 0.75,
    },
  },
  {
    id: 'water',
    type: 'fill',
    source: 'resilience',
    'source-layer': 'water',
    paint: { 'fill-color': '#b9d9e8' },
  },
  {
    id: 'roads',
    type: 'line',
    source: 'resilience',
    'source-layer': 'roads',
    paint: {
      'line-color': [
        'match',
        ['get', 'kind'],
        'highway',
        '#e1b878',
        'major_road',
        '#ffffff',
        '#f5f4ef',
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 15, 4],
    },
  },
  {
    id: 'buildings',
    type: 'fill',
    source: 'resilience',
    'source-layer': 'buildings',
    minzoom: 13,
    paint: {
      'fill-color': '#deddd5',
      'fill-outline-color': '#d0cfc8',
    },
  },
]

export function createMapStyle(baseLayer: BaseLayer): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    name: 'Resilience Maps',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e8ecdf' },
      },
    ],
  }

  if (baseLayer === 'satellite' && satelliteArchive) {
    style.sources.satellite = {
      type: 'raster',
      url: pmtilesUrl(satelliteArchive),
      tileSize: 512,
      attribution: 'Satellite imagery provider',
    }
    style.layers.push({
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
    })
  } else if (mapArchive) {
    style.sources.resilience = {
      type: 'vector',
      url: pmtilesUrl(mapArchive),
      attribution: '© OpenStreetMap contributors',
    }
    style.layers.push(...vectorLayers)
  } else {
    style.sources.openstreetmap = {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    }
    style.layers.push({
      id: 'openstreetmap',
      type: 'raster',
      source: 'openstreetmap',
    })
  }

  if (terrainArchive) {
    style.sources.terrain = {
      type: 'raster-dem',
      url: pmtilesUrl(terrainArchive),
      tileSize: 512,
      encoding: 'terrarium',
    }
    style.layers.push({
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrain',
      paint: {
        'hillshade-shadow-color': '#334735',
        'hillshade-highlight-color': '#fbfaf2',
        'hillshade-exaggeration': 0.28,
      },
    })
  }

  return style
}

export const layerAvailability = {
  pmtiles: Boolean(mapArchive),
  satellite: Boolean(satelliteArchive),
  terrain: Boolean(terrainArchive),
}
