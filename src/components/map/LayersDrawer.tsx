import { X } from 'lucide-react';
import { useLayers } from '@/context/LayersContext';
import { LAYER_OPTIONS } from '@/types/layers';
import { cn } from '@/lib/utils';

interface LayersDrawerProps {
  open: boolean;
  onClose: () => void;
}

const GROUP_LABELS = {
  basemap: 'Map type',
  facilities: 'Facilities',
  offline: 'Offline',
} as const;

export function LayersDrawer({ open, onClose }: LayersDrawerProps) {
  const { layers, toggleLayer } = useLayers();

  if (!open) return null;

  const groups = ['basemap', 'facilities', 'offline'] as const;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed right-4 top-40 z-50 w-72 rounded-2xl bg-surface p-4 shadow-map-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Map layers</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close layers"
            className="rounded-full p-1 text-text-secondary hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {groups.map((group) => {
          const options = LAYER_OPTIONS.filter((o) => o.group === group);
          if (options.length === 0) return null;

          return (
            <div key={group} className="mb-4 last:mb-0">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                {GROUP_LABELS[group]}
              </p>
              <div className="space-y-1">
                {options.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50"
                  >
                    <span className="text-sm text-text-primary">{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={layers[key]}
                      onClick={() => toggleLayer(key)}
                      className={cn(
                        'relative h-6 w-11 rounded-full transition-colors',
                        layers[key] ? 'bg-primary' : 'bg-gray-300',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                          layers[key] && 'translate-x-5',
                        )}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
