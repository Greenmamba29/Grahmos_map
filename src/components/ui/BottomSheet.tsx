import type { ReactNode } from 'react'

/** Shared UI stubs used by later screens */
export function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#F9AB00]/40 bg-[#FEF7E0] px-3 py-2 text-sm text-ink">
      {children}
    </div>
  )
}

export function SegmentedControl({
  options,
  value,
}: {
  options: string[]
  value: string
}) {
  return (
    <div className="inline-flex rounded-full bg-[#F1F3F4] p-1">
      {options.map((opt) => (
        <span
          key={opt}
          className={
            opt === value
              ? 'rounded-full bg-surface px-3 py-1 text-sm font-medium shadow-sm'
              : 'px-3 py-1 text-sm text-ink-muted'
          }
        >
          {opt}
        </span>
      ))}
    </div>
  )
}

export function RangeSlider({
  min,
  max,
  value,
}: {
  min: number
  max: number
  value: number
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      readOnly
      className="w-full accent-primary"
      aria-label="Range"
    />
  )
}

export function BottomSheet({
  open,
  children,
}: {
  open: boolean
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl bg-surface p-4 shadow-[var(--shadow-float)]">
      {children}
    </div>
  )
}
