/** Filter sheet stub — INSTALLATION_GUIDE §1.3 */
export function FilterSheet({ open }: { open: boolean }) {
  if (!open) return null
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl bg-surface p-4 shadow-[var(--shadow-float)]">
      <h2 className="text-base font-semibold">Filters</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Pill toggles, sort control, and capacity/distance range — coming next.
      </p>
    </div>
  )
}
