import { Layers } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/geo'

interface LayersButtonProps {
  active?: boolean
  onClick: () => void
  className?: string
}

export function LayersButton({ active, onClick, className }: LayersButtonProps) {
  return (
    <IconButton
      label="Map layers"
      onClick={onClick}
      className={cn(active && 'ring-2 ring-primary/40', className)}
      aria-expanded={active}
    >
      <Layers className="h-5 w-5 text-ink-muted" strokeWidth={2} />
    </IconButton>
  )
}
