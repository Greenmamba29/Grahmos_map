import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/geo'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  leading?: ReactNode
  children: ReactNode
}

export function Chip({
  active = false,
  leading,
  children,
  className,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition',
        active
          ? 'border-primary bg-primary text-white shadow-sm'
          : 'border-border bg-surface text-ink shadow-[var(--shadow-float)]',
        className,
      )}
      aria-pressed={active}
      {...props}
    >
      {leading}
      {children}
    </button>
  )
}
