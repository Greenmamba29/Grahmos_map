import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import { Protocol } from 'pmtiles'

let registered = false

/** Register the pmtiles:// protocol once for MapLibre. */
export function registerPmtilesProtocol(): void {
  if (registered) return
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  registered = true
}

export function getDefaultCenter(): [number, number] {
  const lng = Number(import.meta.env.VITE_DEFAULT_CENTER_LNG ?? -104.9903)
  const lat = Number(import.meta.env.VITE_DEFAULT_CENTER_LAT ?? 39.7392)
  return [lng, lat]
}

export function getDefaultZoom(): number {
  return Number(import.meta.env.VITE_DEFAULT_ZOOM ?? 11)
}

/**
 * Prefer a custom PMTiles-backed style when configured.
 * Falls back to a free raster OSM style so the Explore screen works without local tiles.
 */
export function getMapStyle(): StyleSpecification | string {
  const pmtilesUrl = import.meta.env.VITE_PMTILES_URL as string | undefined
  const styleUrl = import.meta.env.VITE_MAP_STYLE_URL as string | undefined

  if (styleUrl) return styleUrl

  if (pmtilesUrl && !pmtilesUrl.includes('region.pmtiles')) {
    return {
      version: 8,
      sources: {
        protomaps: {
          type: 'vector',
          url: `pmtiles://${pmtilesUrl}`,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#E8EEF4' },
        },
      ],
    }
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  }
}

export const CATEGORY_LAYER_PREFIX = 'facility-'
