import { SegmentedControl } from "@/ui/SegmentedControl";
import { useFilterStore, type SortBy } from "@/store/useFilterStore";

const OPTIONS: { value: SortBy; label: string }[] = [
  { value: "distance", label: "Distance" },
  { value: "capacity", label: "Capacity" },
  { value: "lastUpdated", label: "Updated" },
];

export function SortSegmentedControl() {
  const sortBy = useFilterStore((s) => s.sortBy);
  const setSortBy = useFilterStore((s) => s.setSortBy);
  return (
    <SegmentedControl options={OPTIONS} value={sortBy} onChange={setSortBy} className="w-full justify-between" />
  );
}
