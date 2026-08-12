import { Layers } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';

interface LayersControlProps {
  onClick: () => void;
  active?: boolean;
}

export function LayersControl({ onClick, active }: LayersControlProps) {
  return (
    <div className="pointer-events-auto absolute right-4 top-28 z-10">
      <IconButton
        icon={Layers}
        label="Map layers"
        onClick={onClick}
        className={active ? 'ring-2 ring-primary ring-offset-1' : undefined}
      />
    </div>
  );
}
