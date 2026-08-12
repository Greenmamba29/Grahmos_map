import { Navigation } from 'lucide-react'
import { Fab } from '@/components/ui/Fab'

interface RouteFabProps {
  onClick: () => void
}

export function RouteFab({ onClick }: RouteFabProps) {
  return (
    <Fab label="Directions" onClick={onClick}>
      <Navigation className="h-6 w-6 fill-white" strokeWidth={2} />
    </Fab>
  )
}
