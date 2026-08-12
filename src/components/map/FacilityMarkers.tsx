import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Marker } from 'maplibre-gl';
import { cn } from '@/lib/cn';
import { categoryMeta, STATUS_META } from '@/lib/taxonomy';
import { useMap } from '@/components/map/MapContext';
import type { Facility } from '@/types';

interface FacilityMarkersProps {
  facilities: Facility[];
  selectedId?: string;
  showLabels: boolean;
  onSelect: (facility: Facility) => void;
}

/**
 * Facility pins as DOM markers portalled from React.
 *
 * DOM markers rather than symbol layers: symbol text needs glyph PBFs, which is
 * one more asset to ship and keep in sync for offline use. Marker counts here are
 * in the tens-to-hundreds, well inside what the DOM handles smoothly, and it keeps
 * the pins styleable with the same Tailwind tokens as the rest of the UI.
 */
export function FacilityMarkers({
  facilities,
  selectedId,
  showLabels,
  onSelect,
}: FacilityMarkersProps) {
  const { map, ready } = useMap();

  // Host nodes are created up front so the portals have a target on the first
  // render; the effect below only hands them to MapLibre for positioning.
  const hosts = useMemo(
    () =>
      facilities.map((facility) => {
        const element = document.createElement('div');
        element.style.cursor = 'pointer';
        return { facility, element };
      }),
    [facilities],
  );

  useEffect(() => {
    if (!map || !ready) return;

    const markers = hosts.map(({ facility, element }) =>
      new Marker({ element, anchor: 'bottom' }).setLngLat([facility.lng, facility.lat]).addTo(map),
    );

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [map, ready, hosts]);

  return (
    <>
      {hosts.map(({ facility, element }) =>
        createPortal(
          <Pin
            facility={facility}
            selected={facility.id === selectedId}
            showLabel={showLabels}
            onSelect={onSelect}
          />,
          element,
          facility.id,
        ),
      )}
    </>
  );
}

interface PinProps {
  facility: Facility;
  selected: boolean;
  showLabel: boolean;
  onSelect: (facility: Facility) => void;
}

function Pin({ facility, selected, showLabel, onSelect }: PinProps) {
  const meta = categoryMeta(facility.category);
  const status = STATUS_META[facility.status];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(facility);
      }}
      aria-label={`${facility.name} — ${status.label}`}
      className="group flex flex-col items-center pb-1"
    >
      <span
        className={cn(
          'grid place-items-center rounded-full border-2 border-white text-white shadow-[var(--shadow-map)] transition-transform',
          selected ? 'h-11 w-11 scale-105' : 'h-8 w-8 group-hover:scale-110',
        )}
        style={{ backgroundColor: meta.color }}
      >
        <Icon size={selected ? 22 : 16} strokeWidth={2.4} />
      </span>

      <span
        className="mt-[-3px] h-2 w-2 rotate-45 border-b-2 border-r-2 border-white"
        style={{ backgroundColor: meta.color }}
      />

      <span
        className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-white shadow-[var(--shadow-pill)]"
        style={{ backgroundColor: status.color }}
        aria-hidden
      />

      {showLabel && (
        <span className="mt-1 max-w-[132px] truncate rounded-md bg-white/92 px-1.5 py-0.5 text-[11px] font-medium text-ink shadow-[var(--shadow-pill)]">
          {facility.name}
        </span>
      )}
    </button>
  );
}
