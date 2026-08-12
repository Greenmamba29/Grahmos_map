import { SegmentedControl } from "@/ui/SegmentedControl";
import { useAppStore, type BaseMapStyle } from "@/store/useAppStore";

const OPTIONS: { value: BaseMapStyle; label: string }[] = [
  { value: "streets", label: "Streets" },
  { value: "terrain", label: "Terrain" },
  { value: "satellite", label: "Satellite" },
];

export function BaseMapSegmentedControl() {
  const baseMapStyle = useAppStore((s) => s.baseMapStyle);
  const setBaseMapStyle = useAppStore((s) => s.setBaseMapStyle);

  return (
    <SegmentedControl
      options={OPTIONS}
      value={baseMapStyle}
      onChange={setBaseMapStyle}
      className="w-full justify-between"
    />
  );
}
