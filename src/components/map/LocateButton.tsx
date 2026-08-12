import { useGeolocation } from "../../hooks/useGeolocation";
import { mapRef } from "../../map/mapInstance";
import { Icon } from "../ui/Icon";

/** Small floating "my location" circle, bottom-right above the primary FAB. */
export function LocateButton() {
  const { locate } = useGeolocation();

  return (
    <button
      aria-label="My location"
      onClick={async () => {
        const loc = await locate();
        mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 15 });
      }}
      className="grid size-12 place-items-center rounded-full bg-white text-ink-soft shadow-[var(--shadow-float)] active:scale-95 transition-transform"
    >
      <Icon name="locate" size={22} className="text-primary" />
    </button>
  );
}
