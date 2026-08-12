import { useAppStore } from "../../store/appStore";
import { Icon } from "../ui/Icon";

/** Small circular stacked-squares button, floating top-right of the map. */
export function LayersButton() {
  const setLayersDrawerOpen = useAppStore((s) => s.setLayersDrawerOpen);
  return (
    <button
      aria-label="Map layers"
      onClick={() => setLayersDrawerOpen(true)}
      className="grid size-10 place-items-center rounded-full bg-white text-ink-soft shadow-[var(--shadow-float)] active:scale-95 transition-transform"
    >
      <Icon name="layers" size={20} />
    </button>
  );
}
