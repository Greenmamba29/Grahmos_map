import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, Polygon } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import {
  GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
} from 'maplibre-gl'
import { BottomNav } from '../components/BottomNav'
import { CategoryChips } from '../components/CategoryChips'
import { LayersDrawer } from '../components/LayersDrawer'
import { MapControls } from '../components/MapControls'
import { MapLegend } from '../components/MapLegend'
import { SearchBar } from '../components/SearchBar'
import { StatusBanner } from '../components/StatusBanner'
import { useConnectivity } from '../hooks/useConnectivity'
import { useFacilities } from '../hooks/useFacilities'
import {
  createMapStyle,
  layerAvailability,
  terrainArchive,
} from '../lib/mapStyle'
import { registerPmtilesProtocol } from '../lib/pmtiles'
import {
  facilityCategories,
  type BaseLayer,
  type Facility,
  type FacilityCategory,
  type LayerState,
} from '../types/map'

const initialCategories = Object.fromEntries(
  facilityCategories.map((category) => [category, true]),
) as LayerState['categories']

const initialLayerState: LayerState = {
  baseLayer: 'streets',
  terrainEnabled: false,
  offlineRegionsVisible: true,
  categories: initialCategories,
}

const categoryShortLabel: Record<FacilityCategory, string> = {
  hospital: 'H',
  school: 'S',
  shelter: '⌂',
  water: 'W',
  power: 'P',
}

const offlineRegion: Feature<Polygon> = {
  type: 'Feature',
  properties: { name: 'Central Nairobi offline region' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [36.775, -1.325],
        [36.864, -1.325],
        [36.864, -1.255],
        [36.775, -1.255],
        [36.775, -1.325],
      ],
    ],
  },
}

function addOfflineRegion(map: MapLibreMap, visible: boolean) {
  if (!visible) {
    if (map.getLayer('offline-region-line')) map.removeLayer('offline-region-line')
    if (map.getLayer('offline-region-fill')) map.removeLayer('offline-region-fill')
    if (map.getSource('offline-region')) map.removeSource('offline-region')
    return
  }

  if (!map.getSource('offline-region')) {
    map.addSource('offline-region', {
      type: 'geojson',
      data: offlineRegion,
    })
    map.addLayer({
      id: 'offline-region-fill',
      type: 'fill',
      source: 'offline-region',
      paint: {
        'fill-color': '#1a73e8',
        'fill-opacity': 0.045,
      },
    })
    map.addLayer({
      id: 'offline-region-line',
      type: 'line',
      source: 'offline-region',
      paint: {
        'line-color': '#1a73e8',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.65,
      },
    })
  } else {
    ;(map.getSource('offline-region') as GeoJSONSource).setData(offlineRegion)
  }
}

function createFacilityMarker(facility: Facility) {
  const marker = document.createElement('button')
  marker.type = 'button'
  marker.className = `facility-marker ${facility.category} ${facility.status}`
  marker.setAttribute('aria-label', `${facility.name}, ${facility.status}`)

  const symbol = document.createElement('span')
  symbol.textContent = categoryShortLabel[facility.category]
  marker.append(symbol)

  const status = document.createElement('i')
  status.setAttribute('aria-hidden', 'true')
  marker.append(status)

  return marker
}

function createFacilityPopup(facility: Facility) {
  const content = document.createElement('div')
  content.className = 'facility-popup'

  const eyebrow = document.createElement('span')
  eyebrow.textContent = facility.category
  const title = document.createElement('strong')
  title.textContent = facility.name
  const details = document.createElement('small')
  details.textContent = `${facility.status} · ${facility.address}`

  content.append(eyebrow, title, details)
  return content
}

export function ExploreScreen() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const layerStateRef = useRef(initialLayerState)
  const [layersOpen, setLayersOpen] = useState(false)
  const [layerState, setLayerState] = useState(initialLayerState)
  const [selectedCategories, setSelectedCategories] = useState(
    new Set<FacilityCategory>(),
  )
  const [query, setQuery] = useState('')
  const [locating, setLocating] = useState(false)
  const online = useConnectivity()
  const { facilities, source } = useFacilities(online)

  useEffect(() => {
    layerStateRef.current = layerState
  }, [layerState])

  const visibleFacilities = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return facilities.filter((facility) => {
      const chipMatches =
        selectedCategories.size === 0 ||
        selectedCategories.has(facility.category)
      const layerVisible = layerState.categories[facility.category]
      const queryMatches =
        !normalizedQuery ||
        facility.name.toLocaleLowerCase().includes(normalizedQuery) ||
        facility.address.toLocaleLowerCase().includes(normalizedQuery)
      return chipMatches && layerVisible && queryMatches
    })
  }, [facilities, layerState.categories, query, selectedCategories])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const unregisterPmtiles = registerPmtilesProtocol()
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createMapStyle(initialLayerState.baseLayer),
      center: [36.8157, -1.2921],
      zoom: 13.2,
      minZoom: 3,
      maxZoom: 18,
      attributionControl: false,
    })

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left',
    )
    map.touchZoomRotate.disableRotation()
    map.dragRotate.disable()

    const syncOverlays = () => {
      addOfflineRegion(map, layerStateRef.current.offlineRegionsVisible)
      if (terrainArchive && map.getSource('terrain')) {
        map.setTerrain(
          layerStateRef.current.terrainEnabled
            ? { source: 'terrain', exaggeration: 1.15 }
            : null,
        )
      }
    }
    map.on('style.load', syncOverlays)
    mapRef.current = map

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
      unregisterPmtiles()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(createMapStyle(layerState.baseLayer))
  }, [layerState.baseLayer])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    addOfflineRegion(map, layerState.offlineRegionsVisible)
    if (terrainArchive && map.getSource('terrain')) {
      map.setTerrain(
        layerState.terrainEnabled
          ? { source: 'terrain', exaggeration: 1.15 }
          : null,
      )
    }
  }, [layerState.offlineRegionsVisible, layerState.terrainEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = visibleFacilities.map((facility) => {
      const popup = new maplibregl.Popup({
        offset: 24,
        closeButton: false,
        className: 'resilience-popup',
      }).setDOMContent(createFacilityPopup(facility))

      return new maplibregl.Marker({
        element: createFacilityMarker(facility),
        anchor: 'bottom',
      })
        .setLngLat([facility.longitude, facility.latitude])
        .setPopup(popup)
        .addTo(map)
    })
  }, [visibleFacilities])

  const toggleChip = (category: FacilityCategory) => {
    setSelectedCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const toggleLayerCategory = (category: FacilityCategory) => {
    setLayerState((current) => ({
      ...current,
      categories: {
        ...current.categories,
        [category]: !current.categories[category],
      },
    }))
  }

  const changeBaseLayer = (baseLayer: BaseLayer) => {
    setLayerState((current) => ({ ...current, baseLayer }))
  }

  const locate = useCallback(() => {
    const map = mapRef.current
    if (!map || !navigator.geolocation) return

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.flyTo({
          center: [coords.longitude, coords.latitude],
          zoom: 15,
          duration: 1200,
        })
        new maplibregl.Marker({ color: '#1a73e8' })
          .setLngLat([coords.longitude, coords.latitude])
          .addTo(map)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )
  }, [])

  return (
    <main className="explore-screen">
      <div ref={mapContainerRef} className="map-canvas" aria-label="Map" />

      <div className="top-controls">
        <SearchBar
          online={online}
          query={query}
          onQueryChange={setQuery}
        />
        <CategoryChips selected={selectedCategories} onToggle={toggleChip} />
      </div>

      <LayersDrawer
        open={layersOpen}
        state={layerState}
        onOpen={() => setLayersOpen(true)}
        onClose={() => setLayersOpen(false)}
        onBaseLayerChange={changeBaseLayer}
        onTerrainToggle={() =>
          setLayerState((current) => ({
            ...current,
            terrainEnabled:
              layerAvailability.terrain && !current.terrainEnabled,
          }))
        }
        onOfflineRegionsToggle={() =>
          setLayerState((current) => ({
            ...current,
            offlineRegionsVisible: !current.offlineRegionsVisible,
          }))
        }
        onCategoryToggle={toggleLayerCategory}
      />

      <StatusBanner online={online} source={source} />
      <MapLegend visibleCount={visibleFacilities.length} />
      <MapControls locating={locating} onLocate={locate} />
      <BottomNav />
    </main>
  )
}
