import { LocateFixed } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'

interface MyLocationButtonProps {
  onClick: () => void
  loading?: boolean
}

export function MyLocationButton({ onClick, loading }: MyLocationButtonProps) {
  return (
    <IconButton
      label="My location"
      onClick={onClick}
      className={loading ? 'animate-pulse' : undefined}
    >
      <LocateFixed className="h-5 w-5 text-primary" strokeWidth={2.25} />
    </IconButton>
  )
}
