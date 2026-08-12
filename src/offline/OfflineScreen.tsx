import { useState } from "react";
import { CloudDownload, X } from "lucide-react";
import { useOfflineStore } from "@/store/useOfflineStore";
import { DownloadedRegionRow } from "./DownloadedRegionRow";
import { StorageUsageBar } from "./StorageUsageBar";
import { RegionSelector } from "./RegionSelector";

export function OfflineScreen() {
  const regions = useOfflineStore((s) => s.regions);
  const removeRegion = useOfflineStore((s) => s.removeRegion);
  const updateRegion = useOfflineStore((s) => s.updateRegion);
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-[#F5F5F3] p-4 pb-24">
      <h1 className="mb-4 text-2xl font-semibold text-ink">Offline maps</h1>

      {!selectorOpen && (
        <button
          type="button"
          onClick={() => setSelectorOpen(true)}
          className="mb-5 flex w-full items-center gap-4 rounded-2xl bg-accent p-4 text-left text-white shadow-elevated"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
            <CloudDownload size={24} />
          </span>
          <span>
            <span className="block text-base font-semibold">See what you can download</span>
            <span className="block text-sm text-white/80">
              Pick a region to keep maps and facilities available offline
            </span>
          </span>
        </button>
      )}

      {selectorOpen && (
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-floating">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Select a region</h2>
            <button
              type="button"
              onClick={() => setSelectorOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-black/5"
            >
              <X size={16} />
            </button>
          </div>
          <RegionSelector />
        </div>
      )}

      <div className="mb-5">
        <StorageUsageBar />
      </div>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Downloaded regions
      </h2>
      <div className="space-y-2">
        {regions.length === 0 && (
          <p className="text-sm text-ink-muted">No regions downloaded yet.</p>
        )}
        {regions.map((region) => (
          <DownloadedRegionRow
            key={region.id}
            region={region}
            onDelete={removeRegion}
            onResync={(id) =>
              updateRegion(id, { status: "downloading" })
            }
          />
        ))}
      </div>

      {regions.some((r) => r.status === "downloading") && (
        <p className="mt-3 text-center text-xs text-ink-faint">
          Downloads continue in the background via the service worker cache.
        </p>
      )}
    </div>
  );
}
