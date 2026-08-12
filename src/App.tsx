import { useEffect, useMemo, useState } from 'react';

import { BottomNav } from './components/BottomNav';
import { CategoryChips } from './components/CategoryChips';
import { ExploreMap } from './components/ExploreMap';
import { FloatingMapActions } from './components/FloatingMapActions';
import { LayersButton, LayersDrawer } from './components/LayersDrawer';
import { OfflineStatusBadge } from './components/OfflineStatusBadge';
import { SearchBar } from './components/SearchBar';
import { categoryChips } from './data/categories';
import { listOfflineRegions } from './lib/offlineStore';
import type { FacilityCategory, LayerState } from './types';

const initialCategories = categoryChips.reduce(
  (accumulator, category) => ({
    ...accumulator,
    [category.id]: true
  }),
  {} as Record<FacilityCategory, boolean>
);

const initialLayers: LayerState = {
  terrain: true,
  satellite: false,
  offlineRegions: true,
  categories: initialCategories
};

function App() {
  const [query, setQuery] = useState('');
  const [layers, setLayers] = useState<LayerState>(initialLayers);
  const [layersOpen, setLayersOpen] = useState(false);
  const [downloadedRegionCount, setDownloadedRegionCount] = useState(0);

  useEffect(() => {
    void listOfflineRegions().then((regions) => setDownloadedRegionCount(regions.length));
  }, []);

  const activeCategories = useMemo(
    () =>
      categoryChips
        .filter((category) => layers.categories[category.id])
        .map((category) => category.id),
    [layers.categories]
  );

  const toggleCategory = (category: FacilityCategory) => {
    setLayers((currentLayers) => ({
      ...currentLayers,
      categories: {
        ...currentLayers.categories,
        [category]: !currentLayers.categories[category]
      }
    }));
  };

  const toggleLayer = (layer: keyof Omit<LayerState, 'categories'>) => {
    setLayers((currentLayers) => ({
      ...currentLayers,
      [layer]: !currentLayers[layer]
    }));
  };

  const locateUser = () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => undefined,
      () => undefined,
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-slate-200 text-slate-950">
      <ExploreMap query={query} layers={layers} />

      <section className="absolute inset-x-3 top-4 z-20 mx-auto max-w-3xl space-y-2">
        <SearchBar query={query} onQueryChange={setQuery} />
        <CategoryChips activeCategories={activeCategories} onToggleCategory={toggleCategory} />
      </section>

      <LayersButton onClick={() => setLayersOpen(true)} />
      <OfflineStatusBadge downloadedRegionCount={downloadedRegionCount} />
      <FloatingMapActions onLocate={locateUser} />
      <BottomNav />

      <LayersDrawer
        isOpen={layersOpen}
        layers={layers}
        onClose={() => setLayersOpen(false)}
        onToggleCategory={toggleCategory}
        onToggleLayer={toggleLayer}
      />
    </main>
  );
}

export default App;
