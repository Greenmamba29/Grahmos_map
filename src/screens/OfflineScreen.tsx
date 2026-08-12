import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, HardDrive, Info, MapPlus } from 'lucide-react';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { RegionCard } from '@/components/offline/RegionCard';
import { RegionPicker } from '@/components/offline/RegionPicker';
import { StorageMeter } from '@/components/offline/StorageMeter';
import { useFacilities } from '@/hooks/useFacilities';
import { useOfflineRegions } from '@/hooks/useOfflineRegions';
import { bboxCenter } from '@/lib/geo';
import { useMapPrefs } from '@/state/mapPrefs';
import type { OfflineRegion } from '@/types';

/**
 * Offline downloads screen: the list of regions stored on the device, each with its
 * size in MB and a status icon, plus the prominent CTA that opens the bbox selector.
 */
export function OfflineScreen() {
  const navigate = useNavigate();
  const { all } = useFacilities();
  const { regions, storage, error, download, remove, refreshRegion, busy } = useOfflineRegions();
  const setCamera = useMapPrefs((state) => state.setCamera);
  const [pickerOpen, setPickerOpen] = useState(false);

  const showOnMap = (region: OfflineRegion) => {
    setCamera(bboxCenter(region.bbox), Math.max(9, region.minZoom + 3));
    useMapPrefs.setState((state) => ({
      layers: { ...state.layers, downloadedRegions: true },
    }));
    navigate('/');
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <ScreenHeader title="Offline maps" subtitle="Regions stored on this device" />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-primary-soft px-4 py-4 text-left"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white">
            <MapPlus size={21} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-semibold text-ink">
              Download region for offline use
            </span>
            <span className="block text-[13px] leading-snug text-ink-muted">
              See what you can download — frame an area to save its map tiles,
              terrain and facility list.
            </span>
          </span>
          <Download size={18} strokeWidth={2.2} className="shrink-0 text-primary-dark" />
        </button>

        <div className="mt-4 rounded-2xl border border-hairline px-4 py-3.5">
          <StorageMeter usage={storage.usage} quota={storage.quota} />
        </div>

        {error && (
          <p className="mt-3 rounded-2xl bg-critical-soft px-4 py-3 text-[13px] leading-snug text-critical">
            {error}
          </p>
        )}

        <h2 className="mt-6 mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
          Downloaded regions
        </h2>

        {regions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline px-4 py-8 text-center">
            <HardDrive size={24} strokeWidth={2} className="mx-auto text-ink-muted" />
            <p className="mt-2 text-[14px] font-medium text-ink">No regions downloaded</p>
            <p className="mx-auto mt-1 max-w-[38ch] text-[13px] leading-snug text-ink-muted">
              Download the area you operate in before you lose connectivity. The app
              keeps working from what is stored here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {regions.map((region) => (
              <RegionCard
                key={region.id}
                region={region}
                onRemove={(id) => void remove(id)}
                onRefresh={(id) => void refreshRegion(id)}
                onShowOnMap={showOnMap}
              />
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-canvas px-4 py-3.5">
          <Info size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-muted" />
          <p className="text-[12.5px] leading-snug text-ink-muted">
            Tiles come from a single PMTiles archive read with HTTP range requests, so
            a download stores exactly the byte ranges your area needs — no tile server
            required. Facility data for the region is snapshotted at the same time.
          </p>
        </div>
      </div>

      <RegionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(request) => {
          if (busy) return;
          void download(request);
        }}
        facilities={all}
        storage={storage}
      />
    </div>
  );
}
