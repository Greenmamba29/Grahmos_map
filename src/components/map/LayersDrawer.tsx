import { HardDrive, MountainSnow, Tag, TriangleAlert } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MapTypeCard } from '@/components/map/MapTypeCard';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Switch } from '@/components/ui/Switch';
import { config } from '@/lib/config';
import { CATEGORIES } from '@/lib/taxonomy';
import { useMap } from '@/components/map/MapContext';
import { useMapPrefs } from '@/state/mapPrefs';
import { useFilters } from '@/state/filters';
import type { BasemapId } from '@/types';

interface LayersDrawerProps {
  open: boolean;
  onClose: () => void;
  downloadedRegionCount: number;
}

/**
 * The layers drawer: basemap choice, terrain and overlay toggles, and per-category
 * facility visibility. Category visibility is the same state the chips drive, so
 * turning a category off here also clears its chip.
 */
export function LayersDrawer({ open, onClose, downloadedRegionCount }: LayersDrawerProps) {
  const { terrainAvailable, vectorAvailable } = useMap();
  const basemap = useMapPrefs((state) => state.basemap);
  const layers = useMapPrefs((state) => state.layers);
  const setBasemap = useMapPrefs((state) => state.setBasemap);
  const toggleLayer = useMapPrefs((state) => state.toggleLayer);
  const categories = useFilters((state) => state.categories);
  const toggleCategory = useFilters((state) => state.toggleCategory);

  const mapTypes: Array<{ id: BasemapId; label: string; disabled?: boolean; hint?: string }> = [
    { id: 'default', label: 'Default' },
    {
      id: 'terrain',
      label: 'Terrain',
      disabled: !terrainAvailable,
      hint: 'Add a terrain archive',
    },
    {
      id: 'satellite',
      label: 'Satellite',
      disabled: !config.satelliteTilesUrl && !config.fallbackRasterTilesUrl,
      hint: 'No imagery source',
    },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Map layers"
      snap="half"
      snapPoints={['half', 'full']}
    >
      <div className="px-4 pb-6">
        <h2 className="pt-1 pb-3 text-[17px] font-semibold text-ink">Map layers</h2>

        <div className="grid grid-cols-3 gap-3">
          {mapTypes.map((type) => (
            <MapTypeCard
              key={type.id}
              id={type.id}
              label={type.label}
              selected={basemap === type.id}
              disabled={type.disabled}
              disabledHint={type.hint}
              onSelect={setBasemap}
            />
          ))}
        </div>

        {!vectorAvailable && (
          <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[12px] leading-snug text-ink">
            No offline vector archive found. The map is using an online raster
            fallback — generate <code>region.pmtiles</code> to work fully offline.
          </p>
        )}

        <div className="mt-5 -mx-4 border-t border-hairline">
          <ToggleRow
            icon={MountainSnow}
            label="Hillshade & 3D terrain"
            description={
              terrainAvailable ? 'Shaded relief from the local DEM' : 'Terrain archive not found'
            }
            checked={layers.hillshade}
            onChange={() => toggleLayer('hillshade')}
            disabled={!terrainAvailable}
          />
          <ToggleRow
            icon={TriangleAlert}
            label="Hazard zones"
            description="Flooding, landslides, blocked roads"
            checked={layers.hazards}
            onChange={() => toggleLayer('hazards')}
            iconColor="#d93025"
          />
          <ToggleRow
            icon={HardDrive}
            label="Downloaded regions"
            description={
              downloadedRegionCount > 0
                ? `${downloadedRegionCount} region${downloadedRegionCount === 1 ? '' : 's'} stored on this device`
                : 'No regions downloaded yet'
            }
            checked={layers.downloadedRegions}
            onChange={() => toggleLayer('downloadedRegions')}
          />
          <ToggleRow
            icon={Tag}
            label="Facility labels"
            description="Show names next to pins"
            checked={layers.labels}
            onChange={() => toggleLayer('labels')}
          />
        </div>

        <div className="-mx-4 border-t border-hairline px-4 pt-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Facility categories
          </h3>
          <p className="mt-1 text-[12px] text-ink-muted">
            All categories are shown when none is selected.
          </p>

          <ul className="mt-2 -mx-4">
            {CATEGORIES.map((meta) => {
              const Icon = meta.icon;
              const checked = categories.length === 0 || categories.includes(meta.id);
              return (
                <li key={meta.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon size={16} strokeWidth={2.4} />
                  </span>
                  <span className="flex-1 text-[15px] text-ink">{meta.label}</span>
                  <Switch
                    checked={checked}
                    label={meta.label}
                    onChange={() => {
                      // Turning one off while "all" is implied selects the rest,
                      // which is what a responder means by hiding a category.
                      if (categories.length === 0) {
                        useFilters.setState({
                          categories: CATEGORIES.filter((item) => item.id !== meta.id).map(
                            (item) => item.id,
                          ),
                        });
                        return;
                      }
                      toggleCategory(meta.id);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </BottomSheet>
  );
}
