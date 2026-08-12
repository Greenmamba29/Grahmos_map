import {
  Cross,
  School,
  Tent,
  Droplet,
  Zap,
  RadioTower,
} from "lucide-react";
import { Chip } from "@/ui/Chip";
import { CATEGORY_META, type FacilityCategory } from "@/data/types";
import { useFilterStore } from "@/store/useFilterStore";

const ICONS: Record<FacilityCategory, React.ReactNode> = {
  hospital: <Cross size={15} />,
  school: <School size={15} />,
  shelter: <Tent size={15} />,
  water: <Droplet size={15} />,
  power: <Zap size={15} />,
  comms: <RadioTower size={15} />,
};

const ORDER: FacilityCategory[] = [
  "hospital",
  "school",
  "shelter",
  "water",
  "power",
  "comms",
];

export function CategoryChips() {
  const activeCategories = useFilterStore((s) => s.activeCategories);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);

  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ORDER.map((category) => {
        const meta = CATEGORY_META[category];
        const active = activeCategories.includes(category);
        return (
          <Chip
            key={category}
            label={meta.label}
            icon={ICONS[category]}
            active={active}
            color={meta.color}
            onClick={() => toggleCategory(category)}
          />
        );
      })}
    </div>
  );
}
