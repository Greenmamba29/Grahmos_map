import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/geo'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({
  label,
  children,
  size = 'md',
  className,
  ...props
}: IconButtonProps) {
  const sizeClass =
    size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-float)] transition active:scale-95',
        sizeClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
