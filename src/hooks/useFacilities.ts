import { useEffect, useMemo, useState } from 'react'
import { demoFacilities } from '../data/demoFacilities'
import { cacheFacilities, readCachedFacilities } from '../lib/offlineDb'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Facility, FacilityCategory } from '../types/facilities'

interface NearbyFacilityRow {
  id: string
  name: string
  category: Facility['category']
  longitude: number
  latitude: number
  capacity: number | null
  status: Facility['status']
  address: string | null
  phone: string | null
  is_verified: boolean
  last_updated: string
}

function normalize(row: NearbyFacilityRow): Facility {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    coordinates: [row.longitude, row.latitude],
    capacity: row.capacity,
    status: row.status,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    isVerified: row.is_verified,
    lastUpdated: row.last_updated,
  }
}

export function useFacilities(activeCategories: Set<FacilityCategory>) {
  const [facilities, setFacilities] = useState<Facility[]>(demoFacilities)
  const [source, setSource] = useState<'demo' | 'cache' | 'live'>('demo')

  useEffect(() => {
    let active = true

    async function load() {
      const cached = await readCachedFacilities()
      if (active && cached.length) {
        setFacilities(cached)
        setSource('cache')
      }

      if (!isSupabaseConfigured || !supabase || !navigator.onLine) return

      const { data, error } = await supabase.rpc('nearby_facilities', {
        search_latitude: Number(import.meta.env.VITE_MAP_INITIAL_LAT ?? -1.2921),
        search_longitude: Number(import.meta.env.VITE_MAP_INITIAL_LNG ?? 36.8219),
        radius_meters: 50000,
        result_limit: 500,
      })

      if (!error && data?.length && active) {
        const normalized = (data as NearbyFacilityRow[]).map(normalize)
        setFacilities(normalized)
        setSource('live')
        await cacheFacilities(normalized)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const visibleFacilities = useMemo(
    () =>
      facilities.filter(
        (facility) =>
          facility.category === 'communications' ||
          activeCategories.has(facility.category),
      ),
    [activeCategories, facilities],
  )

  return { facilities: visibleFacilities, source }
}
