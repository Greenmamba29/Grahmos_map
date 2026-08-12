import { useAppStore } from "../../store/appStore";
import { Icon } from "../ui/Icon";

/** Primary blue circular FAB — opens the Routes screen. */
export function DirectionsFab() {
  const startRoute = useAppStore((s) => s.startRoute);
  const selectedFacilityId = useAppStore((s) => s.selectedFacilityId);

  return (
    <button
      aria-label="Directions"
      onClick={() => startRoute(selectedFacilityId)}
      className="grid size-14 place-items-center rounded-full bg-primary text-white shadow-[var(--shadow-float)] hover:bg-primary-dark active:scale-95 transition-all"
    >
      <Icon name="directions" size={26} />
    </button>
  );
}
