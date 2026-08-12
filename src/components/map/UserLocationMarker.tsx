import { useEffect, useRef } from 'react';
import { Marker } from 'maplibre-gl';
import { useMap } from '@/components/map/MapContext';

interface UserLocationMarkerProps {
  position: [number, number] | null;
  accuracyM: number | null;
}

/** The blue dot, with an accuracy halo when the fix is coarse. */
export function UserLocationMarker({ position, accuracyM }: UserLocationMarkerProps) {
  const { map, ready } = useMap();
  const marker = useRef<Marker | null>(null);

  useEffect(() => {
    if (!map || !ready || !position) return;

    if (!marker.current) {
      const element = document.createElement('div');
      element.setAttribute('aria-label', 'Your location');
      element.style.cssText = 'display:grid;place-items:center;';
      element.innerHTML = `
        <span style="position:absolute;width:44px;height:44px;border-radius:9999px;background:rgba(26,115,232,0.16)"></span>
        <span style="width:16px;height:16px;border-radius:9999px;background:#1a73e8;border:3px solid #fff;box-shadow:0 1px 3px rgba(60,64,67,0.35)"></span>
      `;
      marker.current = new Marker({ element, anchor: 'center' })
        .setLngLat(position)
        .addTo(map);
    } else {
      marker.current.setLngLat(position);
    }

    const halo = marker.current.getElement().firstElementChild as HTMLElement | null;
    if (halo && accuracyM !== null) {
      // Scale the halo with the real accuracy radius at the current zoom.
      const metresPerPixel =
        (156_543.03392 * Math.cos((position[1] * Math.PI) / 180)) / 2 ** map.getZoom();
      const diameter = Math.min(160, Math.max(28, (accuracyM / metresPerPixel) * 2));
      halo.style.width = `${diameter}px`;
      halo.style.height = `${diameter}px`;
    }
  }, [map, ready, position, accuracyM]);

  useEffect(
    () => () => {
      marker.current?.remove();
      marker.current = null;
    },
    [],
  );

  return null;
}
