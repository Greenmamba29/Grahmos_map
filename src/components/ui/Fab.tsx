import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/geo'

interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  variant?: 'primary' | 'surface'
}

export function Fab({
  label,
  children,
  variant = 'primary',
  className,
  ...props
}: FabProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-14 w-14 items-center justify-center rounded-full shadow-[var(--shadow-float)] transition active:scale-95',
        variant === 'primary'
          ? 'bg-primary text-white'
          : 'bg-surface text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
