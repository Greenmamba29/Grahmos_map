import { Route } from 'lucide-react';
import { FAB } from '@/components/ui/FAB';

interface DirectionsFABProps {
  onClick?: () => void;
}

export function DirectionsFAB({ onClick }: DirectionsFABProps) {
  return (
    <div className="pointer-events-auto absolute bottom-20 right-4 z-10">
      <FAB icon={Route} label="Get directions" onClick={onClick} />
    </div>
  );
}
