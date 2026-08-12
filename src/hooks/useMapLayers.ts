import { useCallback, useState } from 'react'
import type { FacilityCategory } from '@/types/facility'
import { FACILITY_CATEGORIES } from '@/types/facility'

export interface MapLayerState {
  terrain: boolean
  satellite: boolean
  offlineRegions: boolean
  categories: Record<FacilityCategory, boolean>
}

const defaultCategories = Object.fromEntries(
  FACILITY_CATEGORIES.map((c) => [c.id, true]),
) as Record<FacilityCategory, boolean>

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayerState>({
    terrain: false,
    satellite: false,
    offlineRegions: true,
    categories: defaultCategories,
  })

  const toggleTerrain = useCallback(() => {
    setLayers((s) => ({ ...s, terrain: !s.terrain }))
  }, [])

  const toggleSatellite = useCallback(() => {
    setLayers((s) => ({ ...s, satellite: !s.satellite }))
  }, [])

  const toggleOfflineRegions = useCallback(() => {
    setLayers((s) => ({ ...s, offlineRegions: !s.offlineRegions }))
  }, [])

  const toggleCategory = useCallback((id: FacilityCategory) => {
    setLayers((s) => ({
      ...s,
      categories: { ...s.categories, [id]: !s.categories[id] },
    }))
  }, [])

  const setCategory = useCallback((id: FacilityCategory, on: boolean) => {
    setLayers((s) => ({
      ...s,
      categories: { ...s.categories, [id]: on },
    }))
  }, [])

  const activeCategories = (
    Object.entries(layers.categories) as [FacilityCategory, boolean][]
  )
    .filter(([, on]) => on)
    .map(([id]) => id)

  return {
    layers,
    activeCategories,
    toggleTerrain,
    toggleSatellite,
    toggleOfflineRegions,
    toggleCategory,
    setCategory,
  }
}
