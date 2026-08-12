import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { RegionCard } from "../components/offline/RegionCard";
import { RegionSelectModal } from "../components/offline/RegionSelectModal";
import { Icon } from "../components/ui/Icon";
import { formatMb } from "../utils/format";

/** Pattern 6 — offline downloads: CTA, region list, storage summary. */
export function OfflineScreen() {
  const regions = useAppStore((s) => s.regions);
  const [selecting, setSelecting] = useState(false);
  const totalMb = regions.reduce((sum, r) => sum + r.sizeMb, 0);

  return (
    <div className="flex grow flex-col overflow-hidden bg-gray-50">
      <div className="grow overflow-y-auto">
        <div className="px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
          <h1 className="text-xl font-medium">Offline maps</h1>
          <p className="text-sm text-ink-soft">
            Downloaded regions keep working with zero connectivity.
          </p>
        </div>

        {/* Prominent CTA */}
        <div className="px-4 py-3">
          <button
            onClick={() => setSelecting(true)}
            className="flex w-full items-center gap-4 rounded-2xl bg-primary p-4 text-left text-white shadow-md hover:bg-primary-dark transition-colors"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
              <Icon name="map" size={22} />
            </span>
            <span className="grow">
              <span className="block font-semibold">
                See what you can download
              </span>
              <span className="block text-sm text-white/85">
                Select an area and save terrain-aware maps + facility data
              </span>
            </span>
            <Icon name="chevronRight" size={22} className="text-white/80" />
          </button>
        </div>

        {/* Downloaded regions */}
        <p className="px-5 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Downloaded regions
        </p>
        <div className="space-y-2 px-4 pb-6">
          {regions.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink-soft">
              No regions downloaded yet.
            </p>
          )}
          {regions.map((r) => (
            <RegionCard key={r.id} region={r} />
          ))}
        </div>
      </div>

      {/* Storage summary */}
      <div className="flex items-center gap-3 border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Icon name="download" size={18} className="text-ink-soft" />
        <div className="grow">
          <div className="mb-1 flex justify-between text-xs text-ink-soft">
            <span>{formatMb(totalMb)} of ~2 GB used</span>
            <span>{regions.length} regions</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (totalMb / 2048) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {selecting && <RegionSelectModal onClose={() => setSelecting(false)} />}
    </div>
  );
}
