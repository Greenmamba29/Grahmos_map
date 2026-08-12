import { useMemo, useState } from 'react'
import { mockFacilities } from '@/data/mockFacilities'
import type { Facility, FacilityCategory } from '@/types/facility'
import { isSupabaseConfigured } from '@/lib/supabase'

export function useFacilities(activeCategories: FacilityCategory[]) {
  // Supabase wiring lands next; mock data keeps Explore usable offline.
  const [facilities] = useState<Facility[]>(mockFacilities)
  const usingMock = !isSupabaseConfigured

  const filtered = useMemo(() => {
    if (activeCategories.length === 0) return []
    return facilities.filter((f) => activeCategories.includes(f.category))
  }, [facilities, activeCategories])

  return { facilities: filtered, all: facilities, usingMock }
}
