import {
  Mountain,
  Satellite,
  Download,
  Building2,
  GraduationCap,
  House,
  Droplets,
  Zap,
  Radio,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { FacilityCategory } from '@/types/facility'
import { FACILITY_CATEGORIES } from '@/types/facility'
import type { MapLayerState } from '@/hooks/useMapLayers'
import { cn } from '@/lib/geo'

const CATEGORY_ICONS: Record<FacilityCategory, ReactNode> = {
  hospital: <Building2 className="h-4 w-4" />,
  school: <GraduationCap className="h-4 w-4" />,
  shelter: <House className="h-4 w-4" />,
  water: <Droplets className="h-4 w-4" />,
  power: <Zap className="h-4 w-4" />,
  comms: <Radio className="h-4 w-4" />,
}

interface LayersDrawerProps {
  open: boolean
  onClose: () => void
  layers: MapLayerState
  onToggleTerrain: () => void
  onToggleSatellite: () => void
  onToggleOfflineRegions: () => void
  onToggleCategory: (id: FacilityCategory) => void
}

function ToggleRow({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string
  description?: string
  icon: ReactNode
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-black/[0.04]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F4] text-ink-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="block text-xs text-ink-muted">{description}</span>
        ) : null}
      </span>
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-primary' : 'bg-[#DADCE0]',
        )}
        aria-hidden
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}

export function LayersDrawer({
  open,
  onClose,
  layers,
  onToggleTerrain,
  onToggleSatellite,
  onToggleOfflineRegions,
  onToggleCategory,
}: LayersDrawerProps) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-30 cursor-default bg-black/20"
        aria-label="Close layers"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Map layers"
        className="absolute top-28 right-3 z-40 w-[min(100%-1.5rem,20rem)] animate-[slideIn_180ms_ease-out] rounded-2xl bg-surface p-3 shadow-[var(--shadow-float)]"
      >
        <div className="mb-1 flex items-center justify-between px-2 pt-1">
          <h2 className="text-base font-semibold text-ink">Layers</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-primary"
          >
            Done
          </button>
        </div>

        <section className="mt-1 border-b border-border pb-2">
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
            Base map
          </p>
          <ToggleRow
            label="Terrain"
            description="Elevation-aware hillshade when tiles available"
            icon={<Mountain className="h-4 w-4" />}
            checked={layers.terrain}
            onChange={onToggleTerrain}
          />
          <ToggleRow
            label="Satellite"
            description="Imagery basemap when offline pack includes it"
            icon={<Satellite className="h-4 w-4" />}
            checked={layers.satellite}
            onChange={onToggleSatellite}
          />
        </section>

        <section className="border-b border-border py-2">
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
            Facilities
          </p>
          {FACILITY_CATEGORIES.map((cat) => (
            <ToggleRow
              key={cat.id}
              label={cat.label}
              icon={
                <span style={{ color: cat.color }}>{CATEGORY_ICONS[cat.id]}</span>
              }
              checked={layers.categories[cat.id]}
              onChange={() => onToggleCategory(cat.id)}
            />
          ))}
        </section>

        <section className="pt-2">
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
            Offline
          </p>
          <ToggleRow
            label="Downloaded regions"
            description="Show bounding boxes of offline packs"
            icon={<Download className="h-4 w-4" />}
            checked={layers.offlineRegions}
            onChange={onToggleOfflineRegions}
          />
        </section>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
