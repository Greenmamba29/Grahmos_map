import { Footprints, Car, Mountain, TreePine } from "lucide-react";
import clsx from "clsx";
import type { TravelMode } from "./mockRouting";

const MODES: { value: TravelMode; label: string; icon: typeof Footprints }[] = [
  { value: "walk", label: "Walk", icon: Footprints },
  { value: "drive", label: "Drive", icon: Car },
  { value: "4x4", label: "4x4", icon: Mountain },
  { value: "terrain", label: "On-foot terrain", icon: TreePine },
];

export function ModeTabs({
  value,
  onChange,
}: {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {MODES.map(({ value: mode, label, icon: Icon }) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              active ? "bg-accent text-white" : "bg-black/[0.05] text-ink hover:bg-black/[0.08]",
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
