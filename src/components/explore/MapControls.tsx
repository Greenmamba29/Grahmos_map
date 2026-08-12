import { Crosshair, LoaderCircle, Navigation } from 'lucide-react';
import { cn } from '@/lib/cn';

interface MyLocationButtonProps {
  onClick: () => void;
  status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';
}

/** Small circular control, sits directly above the primary FAB. */
export function MyLocationButton({ onClick, status }: MyLocationButtonProps) {
  const unavailable = status === 'denied' || status === 'unavailable';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unavailable ? 'Location unavailable' : 'Centre on my location'}
      title={
        status === 'denied'
          ? 'Location permission denied'
          : status === 'unavailable'
            ? 'Location needs HTTPS and a device GPS'
            : 'Centre on my location'
      }
      className={cn(
        'tap-target grid h-11 w-11 place-items-center rounded-full bg-white shadow-[var(--shadow-map)] transition-colors',
        status === 'ready' ? 'text-primary' : 'text-ink-muted hover:text-ink',
        unavailable && 'text-ink-muted/60',
      )}
    >
      {status === 'locating' ? (
        <LoaderCircle size={20} strokeWidth={2.2} className="animate-spin" />
      ) : (
        <Crosshair size={20} strokeWidth={2.2} />
      )}
    </button>
  );
}

interface RouteFabProps {
  onClick: () => void;
  label?: string;
}

/** The larger primary action: plan a terrain-aware route. */
export function RouteFab({ onClick, label = 'Routes' }: RouteFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Plan a route"
      className="flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-white shadow-[var(--shadow-map)] transition-colors hover:bg-primary-dark"
    >
      <Navigation size={22} strokeWidth={2.2} className="fill-white" />
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}
