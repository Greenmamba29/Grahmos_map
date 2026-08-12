/** POI detail stubs — INSTALLATION_GUIDE §1.4 */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-[#E8F0FE] px-2 py-0.5 text-xs font-medium capitalize text-primary">
      {status}
    </span>
  )
}

export function ActionPillRow() {
  return (
    <div className="flex flex-wrap gap-2">
      {['Directions', 'Report Status', 'Save', 'Call'].map((label) => (
        <button
          key={label}
          type="button"
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-primary"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function PoiTabs() {
  return (
    <div className="flex gap-4 border-b border-border text-sm font-medium text-ink-muted">
      {['Overview', 'Capacity', 'Resources', 'Updates'].map((t) => (
        <span key={t} className="pb-2 first:text-primary first:border-b-2 first:border-primary">
          {t}
        </span>
      ))}
    </div>
  )
}

export function PoiDetailSheet({
  open,
  title,
}: {
  open: boolean
  title?: string
}) {
  if (!open) return null
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-auto rounded-t-2xl bg-surface p-4 shadow-[var(--shadow-float)]">
      <h2 className="text-lg font-semibold">{title ?? 'Facility'}</h2>
      <div className="mt-2">
        <StatusBadge status="unknown" />
      </div>
      <div className="mt-3">
        <ActionPillRow />
      </div>
      <div className="mt-4">
        <PoiTabs />
      </div>
    </div>
  )
}
