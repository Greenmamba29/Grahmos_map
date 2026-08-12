import { useMemo, useState } from 'react'
import { MapView } from '@/components/map/MapView'
import { LayersButton } from '@/components/map/LayersButton'
import { LayersDrawer } from '@/components/map/LayersDrawer'
import { MyLocationButton } from '@/components/map/MyLocationButton'
import { RouteFab } from '@/components/map/RouteFab'
import { SearchBar } from '@/components/explore/SearchBar'
import { CategoryChips } from '@/components/explore/CategoryChips'
import { useFacilities } from '@/hooks/useFacilities'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useMapLayers } from '@/hooks/useMapLayers'
interface ExploreScreenProps {
  onOpenRoutes?: () => void
}

type SpeechRecConstructor = new () => {
  lang: string
  start: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
}

export function ExploreScreen({ onOpenRoutes }: ExploreScreenProps) {
  const [query, setQuery] = useState('')
  const [layersOpen, setLayersOpen] = useState(false)
  const [flyToken, setFlyToken] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const {
    layers,
    activeCategories,
    toggleTerrain,
    toggleSatellite,
    toggleOfflineRegions,
    toggleCategory,
  } = useMapLayers()

  const { facilities, usingMock } = useFacilities(activeCategories)
  const { position, loading: locating, locate, error: geoError } = useGeolocation()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return facilities
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.category.includes(q) ||
        f.address?.toLowerCase().includes(q),
    )
  }, [facilities, query])

  const selected = filtered.find((f) => f.id === selectedId) ?? null

  const handleMyLocation = () => {
    locate()
    setFlyToken((n) => n + 1)
  }

  const handleMic = () => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecConstructor
      webkitSpeechRecognition?: SpeechRecConstructor
    }
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript
      if (text) setQuery(text)
    }
    recognition.start()
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView
        facilities={filtered}
        activeCategories={activeCategories}
        showTerrain={layers.terrain}
        showSatellite={layers.satellite}
        showOfflineRegions={layers.offlineRegions}
        userPosition={position}
        flyToUserRequest={flyToken}
        onSelectFacility={setSelectedId}
      />

      {/* Top chrome: search + chips + layers */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              onMic={handleMic}
            />
          </div>
          <LayersButton
            active={layersOpen}
            onClick={() => setLayersOpen((o) => !o)}
          />
        </div>
        <div className="pointer-events-auto mt-2.5">
          <CategoryChips active={activeCategories} onToggle={toggleCategory} />
        </div>
        {usingMock ? (
          <p className="pointer-events-none mt-2 inline-block rounded-full bg-surface/90 px-2.5 py-1 text-[11px] text-ink-muted shadow-sm">
            Demo data · connect Supabase for live facilities
          </p>
        ) : null}
      </div>

      <LayersDrawer
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        layers={layers}
        onToggleTerrain={toggleTerrain}
        onToggleSatellite={toggleSatellite}
        onToggleOfflineRegions={toggleOfflineRegions}
        onToggleCategory={toggleCategory}
      />

      {/* FAB stack */}
      <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-3">
        <MyLocationButton onClick={handleMyLocation} loading={locating} />
        <RouteFab onClick={() => onOpenRoutes?.()} />
      </div>

      {geoError ? (
        <div className="absolute bottom-28 left-3 z-10 max-w-[14rem] rounded-2xl bg-surface px-3 py-2 text-xs text-ink-muted shadow-[var(--shadow-float)]">
          Location: {geoError}
        </div>
      ) : null}

      {selected ? (
        <div className="absolute inset-x-3 bottom-24 z-10 rounded-2xl bg-surface p-4 shadow-[var(--shadow-float)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-ink">{selected.name}</h3>
              <p className="mt-0.5 text-sm capitalize text-ink-muted">
                {selected.category} · {selected.status}
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-primary"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
          {selected.address ? (
            <p className="mt-2 text-sm text-ink-muted">{selected.address}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
