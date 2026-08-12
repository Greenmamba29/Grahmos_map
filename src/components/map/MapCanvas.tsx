import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import * as maplibregl from 'maplibre-gl'
import {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { Protocol } from 'pmtiles'
import type { Facility, LayerPreferences } from '../../types/facilities'

const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)

const vectorUrl = import.meta.env.VITE_VECTOR_PMTILES_URL
const terrainUrl = import.meta.env.VITE_TERRAIN_PMTILES_URL

function baseStyle(): StyleSpecification {
  if (!vectorUrl) {
    return {
      version: 8,
      sources: {
        openstreetmap: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'openstreetmap' }],
    }
  }

  return {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      resilience: {
        type: 'vector',
        url: `pmtiles://${vectorUrl}`,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#E9EEE8' },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'resilience',
        'source-layer': 'water',
        paint: { 'fill-color': '#A9D8F5' },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'resilience',
        'source-layer': 'landcover',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'wood',
            '#D4E5D1',
            'grass',
            '#DCEBD1',
            '#E8ECE5',
          ],
          'fill-opacity': 0.72,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'resilience',
        'source-layer': 'transportation',
        paint: {
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 15, 4],
        },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: 'resilience',
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': '#D9DCD8', 'fill-outline-color': '#C6CAC5' },
      },
    ],
  }
}

function facilitiesGeoJson(facilities: Facility[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: facilities.map((facility) => ({
      type: 'Feature',
      id: facility.id,
      geometry: { type: 'Point', coordinates: facility.coordinates },
      properties: {
        id: facility.id,
        name: facility.name,
        category: facility.category,
        status: facility.status,
      },
    })),
  }
}

export interface MapCanvasHandle {
  locate: () => void
}

interface MapCanvasProps {
  facilities: Facility[]
  preferences: LayerPreferences
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(
  function MapCanvas({ facilities, preferences }, ref) {
    const container = useRef<HTMLDivElement>(null)
    const mapRef = useRef<MapLibreMap | null>(null)
    const initialFacilities = useRef(facilities)
    const initialPreferences = useRef(preferences)

    useImperativeHandle(ref, () => ({
      locate() {
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            mapRef.current?.flyTo({
              center: [coords.longitude, coords.latitude],
              zoom: 15,
              essential: true,
            })
          },
          () => undefined,
          { enableHighAccuracy: true, timeout: 8000 },
        )
      },
    }))

    useEffect(() => {
      if (!container.current) return

      const map = new maplibregl.Map({
        container: container.current,
        style: baseStyle(),
        center: [
          Number(import.meta.env.VITE_MAP_INITIAL_LNG ?? 36.8219),
          Number(import.meta.env.VITE_MAP_INITIAL_LAT ?? -1.2921),
        ],
        zoom: Number(import.meta.env.VITE_MAP_INITIAL_ZOOM ?? 12),
        attributionControl: { compact: true },
        maxPitch: 70,
      })
      mapRef.current = map

      map.on('load', () => {
        if (terrainUrl) {
          map.addSource('terrain-dem', {
            type: 'raster-dem',
            url: `pmtiles://${terrainUrl}`,
            tileSize: 256,
          })
          map.addLayer({
            id: 'terrain-hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: {
              'hillshade-shadow-color': '#4F5B45',
              'hillshade-highlight-color': '#FFFFFF',
              'hillshade-exaggeration': 0.3,
            },
          })
        }

        map.addSource('downloaded-regions', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [36.7905, -1.318],
                  [36.8505, -1.318],
                  [36.8505, -1.268],
                  [36.7905, -1.268],
                  [36.7905, -1.318],
                ],
              ],
            },
          },
        })
        map.addLayer({
          id: 'downloaded-regions-fill',
          type: 'fill',
          source: 'downloaded-regions',
          paint: { 'fill-color': '#1A73E8', 'fill-opacity': 0.06 },
          layout: {
            visibility: initialPreferences.current.downloadedRegions ? 'visible' : 'none',
          },
        })
        map.addLayer({
          id: 'downloaded-regions-line',
          type: 'line',
          source: 'downloaded-regions',
          paint: {
            'line-color': '#1A73E8',
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
          layout: {
            visibility: initialPreferences.current.downloadedRegions ? 'visible' : 'none',
          },
        })

        map.addSource('facilities', {
          type: 'geojson',
          data: facilitiesGeoJson(initialFacilities.current),
        })
        map.addLayer({
          id: 'facility-halo',
          type: 'circle',
          source: 'facilities',
          paint: {
            'circle-radius': 11,
            'circle-color': '#FFFFFF',
            'circle-stroke-color': '#D5DAE1',
            'circle-stroke-width': 1,
          },
        })
        map.addLayer({
          id: 'facility-points',
          type: 'circle',
          source: 'facilities',
          paint: {
            'circle-radius': 7,
            'circle-color': [
              'match',
              ['get', 'category'],
              'hospital',
              '#D93025',
              'school',
              '#7B61FF',
              'shelter',
              '#1A73E8',
              'water',
              '#0097A7',
              'power',
              '#F9AB00',
              '#5F6368',
            ],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 1.5,
          },
        })

        map.on('click', 'facility-points', (event) => {
          const feature = event.features?.[0]
          const coordinates = (feature?.geometry as Point | undefined)
            ?.coordinates as [number, number] | undefined
          if (!feature?.properties || !coordinates) return
          new maplibregl.Popup({ offset: 14, closeButton: false })
            .setLngLat(coordinates)
            .setHTML(
              `<strong>${String(feature.properties.name)}</strong><span>${String(feature.properties.status)}</span>`,
            )
            .addTo(map)
        })
        map.on('mouseenter', 'facility-points', () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'facility-points', () => {
          map.getCanvas().style.cursor = ''
        })
      })

      return () => {
        map.remove()
        mapRef.current = null
      }
    }, [])

    useEffect(() => {
      const map = mapRef.current
      if (!map?.isStyleLoaded()) return
      const source = map.getSource('facilities') as GeoJSONSource | undefined
      source?.setData(facilitiesGeoJson(facilities))
    }, [facilities])

    useEffect(() => {
      const map = mapRef.current
      if (!map?.isStyleLoaded()) return
      const visibility = preferences.downloadedRegions ? 'visible' : 'none'
      for (const layer of ['downloaded-regions-fill', 'downloaded-regions-line']) {
        if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility)
      }
      if (terrainUrl && map.getSource('terrain-dem')) {
        map.setTerrain(preferences.terrain ? { source: 'terrain-dem', exaggeration: 1.15 } : null)
        map.setPitch(preferences.terrain ? 35 : 0)
      }
    }, [preferences.downloadedRegions, preferences.terrain])

    return <div ref={container} className="map-canvas" aria-label="Critical infrastructure map" />
  },
)
