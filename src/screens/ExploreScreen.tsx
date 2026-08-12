import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapProvider } from "@/map/MapProvider";
import { MapCanvas } from "@/map/MapCanvas";
import { MyLocationButton } from "@/map/MyLocationButton";
import { PrimaryFab } from "@/map/PrimaryFab";
import { SearchBar } from "@/search/SearchBar";
import { CategoryChips } from "@/filters/CategoryChips";
import { LayersButton } from "@/layers/LayersButton";
import { LayersDrawer } from "@/layers/LayersDrawer";
import { FilterSheet } from "@/filters/FilterSheet";
import { PoiDetailSheet } from "@/poi/PoiDetailSheet";
import { OfflineBanner } from "@/network/OfflineBanner";
import { useFacilities } from "@/data/useFacilities";
import { useFilterStore } from "@/store/useFilterStore";
import { useAppStore } from "@/store/useAppStore";

export function ExploreScreen() {
  const { facilities } = useFacilities();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [params, setParams] = useSearchParams();

  const activeCategories = useFilterStore((s) => s.activeCategories);
  const selectedFacilityId = useAppStore((s) => s.selectedFacilityId);
  const selectFacility = useAppStore((s) => s.selectFacility);

  useEffect(() => {
    const poiParam = params.get("poi");
    if (poiParam) selectFacility(poiParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredFacilities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facilities.filter((f) => {
      if (!activeCategories.includes(f.category)) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.address?.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [facilities, activeCategories, query]);

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) ?? null;

  function handleSelectFacility(id: string) {
    selectFacility(id);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("poi", id);
      return next;
    });
  }

  function handleCloseDetail() {
    selectFacility(null);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("poi");
      return next;
    });
  }

  return (
    <MapProvider>
      <div className="relative h-full w-full overflow-hidden">
        <MapCanvas facilities={filteredFacilities} onSelectFacility={handleSelectFacility} />

        <OfflineBanner />

        <div className="absolute inset-x-0 top-0 z-10 space-y-2 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchBar value={query} onChange={setQuery} onFocusChange={setSearchFocused} />
            </div>
            {!searchFocused && <LayersButton />}
          </div>
          {!searchFocused && <CategoryChips />}
        </div>

        {!searchFocused && (
          <div className="absolute bottom-6 right-3 z-10 flex flex-col items-end gap-3">
            <MyLocationButton />
            <PrimaryFab />
          </div>
        )}

        <LayersDrawer />
        <FilterSheet />
        <PoiDetailSheet facility={selectedFacility} onClose={handleCloseDetail} />
      </div>
    </MapProvider>
  );
}
