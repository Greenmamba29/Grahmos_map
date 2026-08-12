import { ShieldCheck } from 'lucide-react'

interface MapLegendProps {
  visibleCount: number
}

export function MapLegend({ visibleCount }: MapLegendProps) {
  return (
    <div className="map-legend">
      <span className="verified-mark">
        <ShieldCheck size={14} />
      </span>
      <span>
        <strong>{visibleCount}</strong>{' '}
        {visibleCount === 1 ? 'facility' : 'facilities'} in view
      </span>
    </div>
  )
}
