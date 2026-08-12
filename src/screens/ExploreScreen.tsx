import { MapView } from "../components/map/MapView";
import { LocateButton } from "../components/map/LocateButton";
import { DirectionsFab } from "../components/map/DirectionsFab";
import { LayersButton } from "../components/map/LayersButton";
import { LayersDrawer } from "../components/map/LayersDrawer";
import { SearchBar } from "../components/explore/SearchBar";
import { CategoryChips } from "../components/explore/CategoryChips";
import { FilterSheet } from "../components/explore/FilterSheet";
import { PoiSheet } from "../components/poi/PoiSheet";
import { useAppStore } from "../store/appStore";

/** Pattern 1 — full-bleed map, floating search, chips, FABs, POI sheet. */
export function ExploreScreen() {
  const selectedFacilityId = useAppStore((s) => s.selectedFacilityId);

  return (
    <div className="relative grow overflow-hidden">
      <MapView />

      {/* Top overlay: search + chips */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <SearchBar />
        <CategoryChips />
      </div>

      {/* Layers control, below the chips on the right */}
      <div className="absolute right-4 top-32 z-10">
        <LayersButton />
      </div>

      {/* Floating action buttons */}
      {!selectedFacilityId && (
        <div className="absolute bottom-6 right-4 z-10 flex flex-col items-end gap-3">
          <LocateButton />
          <DirectionsFab />
        </div>
      )}

      <PoiSheet />
      <LayersDrawer />
      <FilterSheet />
    </div>
  );
}
