import { useState, useCallback, useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import { MapView } from '@/components/map/MapView';
import { SearchBar } from '@/components/map/SearchBar';
import { CategoryChips } from '@/components/map/CategoryChips';
import { LayersControl } from '@/components/map/LayersControl';
import { LayersDrawer } from '@/components/map/LayersDrawer';
import { MyLocationButton } from '@/components/map/MyLocationButton';
import { DirectionsFAB } from '@/components/map/DirectionsFAB';
import { useFacilities } from '@/hooks/useFacilities';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getDefaultCenter } from '@/lib/mapStyle';
import type { FacilityCategory } from '@/types/facility';

export function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<FacilityCategory[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  const defaultCenter = getDefaultCenter();
  const { latitude, longitude, requestLocation, loading: geoLoading } = useGeolocation();
  const mapLat = latitude ?? defaultCenter[1];
  const mapLng = longitude ?? defaultCenter[0];

  const { facilities } = useFacilities(mapLat, mapLng, activeCategories);

  const handleToggleCategory = useCallback((category: FacilityCategory) => {
    setActiveCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }, []);

  const handleMyLocation = useCallback(() => {
    requestLocation();
  }, [requestLocation]);

  // Fly to user location once geolocation resolves
  useEffect(() => {
    if (mapInstance && latitude && longitude) {
      mapInstance.flyTo({ center: [longitude, latitude], zoom: 14 });
    }
  }, [mapInstance, latitude, longitude]);

  const filteredFacilities = searchQuery
    ? facilities.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : facilities;

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <MapView
          facilities={filteredFacilities}
          center={[mapLng, mapLat]}
          onMapReady={setMapInstance}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <CategoryChips
            activeCategories={activeCategories}
            onToggle={handleToggleCategory}
          />
        </div>

        <LayersControl
          onClick={() => setLayersOpen((o) => !o)}
          active={layersOpen}
        />
        <LayersDrawer open={layersOpen} onClose={() => setLayersOpen(false)} />

        <MyLocationButton onClick={handleMyLocation} loading={geoLoading} />
        <DirectionsFAB onClick={() => {/* Route screen — phase 5 */}} />
      </div>
    </div>
  );
}
