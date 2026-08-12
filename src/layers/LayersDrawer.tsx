import { Mountain, MapPinned, TriangleAlert } from "lucide-react";
import { BottomSheet } from "@/ui/BottomSheet";
import { CATEGORY_META, type FacilityCategory } from "@/data/types";
import { useAppStore } from "@/store/useAppStore";
import { useFilterStore } from "@/store/useFilterStore";
import { LayerToggleRow } from "./LayerToggleRow";
import { BaseMapSegmentedControl } from "./BaseMapSegmentedControl";

const ALL_CATEGORIES: FacilityCategory[] = [
  "hospital",
  "school",
  "shelter",
  "water",
  "power",
  "comms",
];

export function LayersDrawer() {
  const isOpen = useAppStore((s) => s.isLayersDrawerOpen);
  const closeLayersDrawer = useAppStore((s) => s.closeLayersDrawer);
  const showTerrainOverlay = useAppStore((s) => s.showTerrainOverlay);
  const toggleTerrainOverlay = useAppStore((s) => s.toggleTerrainOverlay);
  const showOfflineRegionsOverlay = useAppStore((s) => s.showOfflineRegionsOverlay);
  const toggleOfflineRegionsOverlay = useAppStore((s) => s.toggleOfflineRegionsOverlay);
  const showHazardOverlay = useAppStore((s) => s.showHazardOverlay);
  const toggleHazardOverlay = useAppStore((s) => s.toggleHazardOverlay);

  const activeCategories = useFilterStore((s) => s.activeCategories);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);

  return (
    <BottomSheet
      open={isOpen}
      onClose={closeLayersDrawer}
      title="Map layers"
      anchorRightOnDesktop
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Base map
          </h3>
          <BaseMapSegmentedControl />
        </section>

        <section className="space-y-1">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Terrain & hazards
          </h3>
          <LayerToggleRow
            icon={<Mountain size={17} />}
            label="Terrain overlay"
            description="Hillshade + contour lines for elevation-aware routing"
            checked={showTerrainOverlay}
            onChange={toggleTerrainOverlay}
          />
          <LayerToggleRow
            icon={<TriangleAlert size={17} />}
            label="Hazard reports"
            description="Flood, fire, and blocked-road overlays"
            checked={showHazardOverlay}
            onChange={toggleHazardOverlay}
          />
          <LayerToggleRow
            icon={<MapPinned size={17} />}
            label="Downloaded regions"
            description="Show bounding boxes of offline-ready areas"
            checked={showOfflineRegionsOverlay}
            onChange={toggleOfflineRegionsOverlay}
          />
        </section>

        <section className="space-y-1">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Facility categories
          </h3>
          {ALL_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            return (
              <LayerToggleRow
                key={category}
                icon={
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                }
                label={meta.label}
                checked={activeCategories.includes(category)}
                onChange={() => toggleCategory(category)}
              />
            );
          })}
        </section>
      </div>
    </BottomSheet>
  );
}
