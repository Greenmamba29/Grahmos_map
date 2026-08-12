import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map, MapLayerMouseEvent } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import {
  getDefaultCenter,
  getDefaultZoom,
  getMapStyle,
  registerPmtilesProtocol,
} from '@/lib/maplibre'
import type { Facility, FacilityCategory } from '@/types/facility'
import { FACILITY_CATEGORIES } from '@/types/facility'

const SOURCE_ID = 'facilities'
const OFFLINE_SOURCE_ID = 'offline-regions'

function facilitiesToGeoJSON(facilities: Facility[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: facilities.map((f) => ({
      type: 'Feature',
      id: f.id,
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
      properties: {
        id: f.id,
        name: f.name,
        category: f.category,
        status: f.status,
      },
    })),
  }
}

/** Demo offline-downloaded region overlay (Denver metro bbox). */
const DEMO_OFFLINE_REGION: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Denver Metro (downloaded)' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-105.15, 39.55],
            [-104.7, 39.55],
            [-104.7, 39.85],
            [-105.15, 39.85],
            [-105.15, 39.55],
          ],
        ],
      },
    },
  ],
}

export interface MapViewProps {
  facilities: Facility[]
  activeCategories: FacilityCategory[]
  showTerrain: boolean
  showSatellite: boolean
  showOfflineRegions: boolean
  userPosition?: { lng: number; lat: number } | null
  flyToUserRequest?: number
  onSelectFacility?: (id: string) => void
}

export function MapView({
  facilities,
  activeCategories,
  showTerrain,
  showSatellite,
  showOfflineRegions,
  userPosition,
  flyToUserRequest = 0,
  onSelectFacility,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const readyRef = useRef(false)
  const onSelectRef = useRef(onSelectFacility)
  onSelectRef.current = onSelectFacility

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    registerPmtilesProtocol()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: getDefaultCenter(),
      zoom: getDefaultZoom(),
      attributionControl: { compact: true },
    })

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    )

    const onLoad = () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: facilitiesToGeoJSON([]),
        })

        for (const cat of FACILITY_CATEGORIES) {
          map.addLayer({
            id: `facility-circle-${cat.id}`,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['get', 'category'], cat.id],
            paint: {
              'circle-radius': 9,
              'circle-color': cat.color,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          })
        }

        map.addSource(OFFLINE_SOURCE_ID, {
          type: 'geojson',
          data: DEMO_OFFLINE_REGION,
        })

        map.addLayer({
          id: 'offline-regions-fill',
          type: 'fill',
          source: OFFLINE_SOURCE_ID,
          paint: {
            'fill-color': '#1A73E8',
            'fill-opacity': 0.08,
          },
        })

        map.addLayer({
          id: 'offline-regions-line',
          type: 'line',
          source: OFFLINE_SOURCE_ID,
          paint: {
            'line-color': '#1A73E8',
            'line-width': 2,
            'line-dasharray': [2, 1.5],
          },
        })

        map.addSource('user-location', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'user-location-pulse',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': 18,
            'circle-color': '#1A73E8',
            'circle-opacity': 0.18,
          },
        })

        map.addLayer({
          id: 'user-location-dot',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': 6,
            'circle-color': '#1A73E8',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })

        for (const cat of FACILITY_CATEGORIES) {
          map.on(
            'click',
            `facility-circle-${cat.id}`,
            (e: MapLayerMouseEvent) => {
              const id = e.features?.[0]?.properties?.id as string | undefined
              if (id) onSelectRef.current?.(id)
            },
          )
          map.on('mouseenter', `facility-circle-${cat.id}`, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', `facility-circle-${cat.id}`, () => {
            map.getCanvas().style.cursor = ''
          })
        }
      }

      readyRef.current = true
    }

    map.on('load', onLoad)
    mapRef.current = map

    return () => {
      map.off('load', onLoad)
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (!map.isStyleLoaded() || !map.getSource(SOURCE_ID)) return false
      const source = map.getSource(SOURCE_ID) as GeoJSONSource
      source.setData(facilitiesToGeoJSON(facilities))

      for (const cat of FACILITY_CATEGORIES) {
        const visible = activeCategories.includes(cat.id) ? 'visible' : 'none'
        if (map.getLayer(`facility-circle-${cat.id}`)) {
          map.setLayoutProperty(
            `facility-circle-${cat.id}`,
            'visibility',
            visible,
          )
        }
      }

      const vis = showOfflineRegions ? 'visible' : 'none'
      if (map.getLayer('offline-regions-fill')) {
        map.setLayoutProperty('offline-regions-fill', 'visibility', vis)
        map.setLayoutProperty('offline-regions-line', 'visibility', vis)
      }

      map.getContainer().dataset.terrain = showTerrain ? 'on' : 'off'
      map.getContainer().dataset.satellite = showSatellite ? 'on' : 'off'
      if (showSatellite) {
        map.getCanvas().style.filter = 'saturate(1.15) contrast(1.05)'
      } else if (showTerrain) {
        map.getCanvas().style.filter = 'sepia(0.12) contrast(1.08)'
      } else {
        map.getCanvas().style.filter = ''
      }

      if (userPosition && map.getSource('user-location')) {
        const userSource = map.getSource('user-location') as GeoJSONSource
        userSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [userPosition.lng, userPosition.lat],
              },
            },
          ],
        })
      }
      return true
    }

    if (apply()) return

    map.on('load', apply)
    const id = window.setInterval(() => {
      if (apply()) window.clearInterval(id)
    }, 50)

    return () => {
      map.off('load', apply)
      window.clearInterval(id)
    }
  }, [
    facilities,
    activeCategories,
    showOfflineRegions,
    showTerrain,
    showSatellite,
    userPosition,
  ])

  useEffect(() => {
    if (!flyToUserRequest || !userPosition || !mapRef.current) return
    mapRef.current.flyTo({
      center: [userPosition.lng, userPosition.lat],
      zoom: Math.max(mapRef.current.getZoom(), 13),
      essential: true,
    })
  }, [flyToUserRequest, userPosition])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      role="application"
      aria-label="Resilience map"
    />
  )
}
