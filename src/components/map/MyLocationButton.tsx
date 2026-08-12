import { Navigation } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';

interface MyLocationButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function MyLocationButton({ onClick, loading }: MyLocationButtonProps) {
  return (
    <div className="pointer-events-auto absolute bottom-36 right-4 z-10">
      <IconButton
        icon={Navigation}
        label="My location"
        onClick={onClick}
        className={loading ? 'animate-pulse' : undefined}
      />
    </div>
  );
}
