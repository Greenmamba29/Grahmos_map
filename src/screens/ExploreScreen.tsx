import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapCanvas } from '@/components/map/MapCanvas';
import { FacilityMarkers } from '@/components/map/FacilityMarkers';
import { HazardLayer } from '@/components/map/HazardLayer';
import { LayersButton } from '@/components/map/LayersButton';
import { LayersDrawer } from '@/components/map/LayersDrawer';
import { RegionOverlay } from '@/components/map/RegionOverlay';
import { UserLocationMarker } from '@/components/map/UserLocationMarker';
import { CategoryChips } from '@/components/explore/CategoryChips';
import { FilterSheet } from '@/components/explore/FilterSheet';
import { MyLocationButton, RouteFab } from '@/components/explore/MapControls';
import { SearchBar } from '@/components/explore/SearchBar';
import { SearchSheet } from '@/components/explore/SearchSheet';
import { FacilitySheet } from '@/components/facility/FacilitySheet';
import { ReportStatusSheet } from '@/components/facility/ReportStatusSheet';
import { OfflineBanner } from '@/components/shell/OfflineBanner';
import { useFacilities } from '@/hooks/useFacilities';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSavedFacilities } from '@/hooks/useSavedFacilities';
import { useOfflineRegions } from '@/hooks/useOfflineRegions';
import { useMapPrefs } from '@/state/mapPrefs';
import { useFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import type { Facility, FacilityCategory } from '@/types';

/**
 * Home screen: full-bleed map with floating chrome.
 *
 * The map is mounted once and never unmounted while this screen is active — sheets
 * float above it rather than replacing it, so a responder never loses map context
 * (and the tile cache is never re-primed for no reason).
 */
export function ExploreScreen() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { all, visible, hazards, source, fetchedAt, refresh } = useFacilities();
  const { locate, status: geoStatus, position, accuracyM } = useGeolocation();
  const { savedIds, toggleSaved } = useSavedFacilities();
  const { regions } = useOfflineRegions();

  const layers = useMapPrefs((state) => state.layers);
  const activeFilterCount = useFilters((state) => state.activeCount());
  const selectedFacility = useSession((state) => state.selectedFacility);
  const selectFacility = useSession((state) => state.selectFacility);
  const setRouteTarget = useSession((state) => state.setRouteTarget);

  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Facility | null>(null);
  const [reportNonce, setReportNonce] = useState(0);

  const counts = useMemo(() => {
    const tally: Partial<Record<FacilityCategory, number>> = {};
    for (const facility of all) {
      tally[facility.category] = (tally[facility.category] ?? 0) + 1;
    }
    return tally;
  }, [all]);

  const downloadedRegions = useMemo(
    () => regions.filter((region) => region.status === 'downloaded'),
    [regions],
  );

  const handleDirections = useCallback(
    (facility: Facility) => {
      setRouteTarget(facility);
      navigate('/routes');
    },
    [navigate, setRouteTarget],
  );

  // Clearing every category via the layers drawer would blank the map; the chips
  // treat "none selected" as "show all", so nothing further is needed here.
  useEffect(() => {
    if (selectedFacility && !visible.some((item) => item.id === selectedFacility.id)) {
      selectFacility(null);
    }
  }, [visible, selectedFacility, selectFacility]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas bottomPadding={220}>
        <FacilityMarkers
          facilities={visible}
          selectedId={selectedFacility?.id}
          showLabels={layers.labels}
          onSelect={selectFacility}
        />
        <HazardLayer hazards={hazards} visible={layers.hazards} />
        <RegionOverlay regions={downloadedRegions} visible={layers.downloadedRegions} />
        <UserLocationMarker position={position} accuracyM={accuracyM} />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-safe">
          <div className="pointer-events-auto pt-3">
            <SearchBar
              onOpenSearch={() => setSearchOpen(true)}
              onOpenFilters={() => setFiltersOpen(true)}
              activeFilterCount={activeFilterCount}
            />
          </div>

          <div className="pointer-events-auto mt-2.5">
            <CategoryChips counts={counts} />
          </div>

          <div className="pointer-events-auto mt-2.5 flex justify-start">
            <OfflineBanner online={online} source={source} fetchedAt={fetchedAt} />
          </div>
        </div>

        <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+124px)] z-20">
          <LayersButton onClick={() => setLayersOpen(true)} active={layersOpen} />
        </div>

        <div className="pointer-events-none absolute bottom-0 right-4 z-20 flex flex-col items-end gap-3 pb-[76px]">
          <div className="pointer-events-auto">
            <MyLocationButton onClick={locate} status={geoStatus} />
          </div>
          <div className="pointer-events-auto">
            <RouteFab onClick={() => navigate('/routes')} />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-[76px] left-4 z-10">
          <ResultCount count={visible.length} total={all.length} />
        </div>
      </MapCanvas>

      <SearchSheet
        key={searchOpen ? 'search-open' : 'search-closed'}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        facilities={all}
        online={online}
        onSelect={selectFacility}
      />

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        resultCount={visible.length}
      />

      <LayersDrawer
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        downloadedRegionCount={downloadedRegions.length}
      />

      {selectedFacility && !searchOpen && !filtersOpen && !layersOpen && (
        <FacilitySheet
          key={selectedFacility.id}
          facility={selectedFacility}
          saved={savedIds.includes(selectedFacility.id)}
          onClose={() => selectFacility(null)}
          onDirections={handleDirections}
          onReport={setReportTarget}
          onSave={(facility) => void toggleSaved(facility.id)}
          refreshKey={reportNonce}
        />
      )}

      <ReportStatusSheet
        key={reportTarget?.id ?? 'no-report-target'}
        facility={reportTarget}
        open={reportTarget !== null}
        online={online}
        onClose={() => setReportTarget(null)}
        onSubmitted={() => {
          setReportNonce((value) => value + 1);
          refresh();
        }}
      />
    </div>
  );
}

function ResultCount({ count, total }: { count: number; total: number }) {
  if (count === total) return null;
  return (
    <span className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink shadow-[var(--shadow-map)]">
      {count} of {total} shown
    </span>
  );
}
