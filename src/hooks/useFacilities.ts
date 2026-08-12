import { useEffect, useState } from 'react'
import { demoFacilities } from '../data/demoFacilities'
import { cacheFacilities, readCachedFacilities } from '../lib/db'
import { supabase } from '../lib/supabase'
import type { Facility } from '../types/map'

interface FacilityRow {
  id: string
  name: string
  category: Facility['category']
  status: Facility['status']
  capacity: number | null
  longitude: number
  latitude: number
  address: string | null
  last_updated: string
}

const toFacility = (row: FacilityRow): Facility => ({
  id: row.id,
  name: row.name,
  category: row.category,
  status: row.status,
  capacity: row.capacity,
  longitude: row.longitude,
  latitude: row.latitude,
  address: row.address ?? 'Address unavailable',
  lastUpdated: row.last_updated,
})

export function useFacilities(online: boolean) {
  const [facilities, setFacilities] = useState<Facility[]>(demoFacilities)
  const [source, setSource] = useState<'demo' | 'cache' | 'live'>('demo')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const cached = await readCachedFacilities()
      if (!cancelled && cached.length > 0) {
        setFacilities(cached)
        setSource('cache')
      }

      if (!online || !supabase) return

      const { data, error } = await supabase.rpc('facilities_in_view', {
        min_lat: -1.36,
        min_long: 36.74,
        max_lat: -1.23,
        max_long: 36.9,
        requested_categories: null,
        result_limit: 500,
      })

      if (error || !data || cancelled) return

      const liveFacilities = (data as FacilityRow[]).map(toFacility)
      setFacilities(liveFacilities)
      setSource('live')
      await cacheFacilities(liveFacilities)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [online])

  return { facilities, source }
}
