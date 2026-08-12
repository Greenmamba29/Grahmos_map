import { CheckCircle2, Clock, AlertCircle, RefreshCw, Trash2, Loader2 } from "lucide-react";
import type { OfflineRegion } from "@/data/types";

const STATUS_CONFIG: Record<
  OfflineRegion["status"],
  { icon: typeof CheckCircle2; color: string; label: string }
> = {
  ready: { icon: CheckCircle2, color: "#1E8E3E", label: "Ready" },
  downloading: { icon: Loader2, color: "#1A73E8", label: "Downloading" },
  queued: { icon: Clock, color: "#5F6368", label: "Queued" },
  stale: { icon: AlertCircle, color: "#B06000", label: "Needs update" },
  failed: { icon: AlertCircle, color: "#D93025", label: "Failed" },
};

export function DownloadedRegionRow({
  region,
  onDelete,
  onResync,
}: {
  region: OfflineRegion;
  onDelete: (id: string) => void;
  onResync: (id: string) => void;
}) {
  const config = STATUS_CONFIG[region.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-floating">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-accent-soft">
        <svg viewBox="0 0 56 56" className="h-full w-full text-accent/40">
          <rect x="4" y="4" width="48" height="48" rx="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M8 38 L20 24 L28 32 L38 18 L48 30" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{region.name}</p>
        <p className="text-xs text-ink-muted">
          {region.sizeEstimateMb} MB · z{region.minZoom}–{region.maxZoom}
          {region.downloadedAt && ` · ${new Date(region.downloadedAt).toLocaleDateString()}`}
        </p>
        <div className="mt-1 flex items-center gap-1 text-xs font-medium" style={{ color: config.color }}>
          <Icon size={13} className={region.status === "downloading" ? "animate-spin" : undefined} />
          {config.label}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {region.status === "stale" && (
          <button
            type="button"
            onClick={() => onResync(region.id)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-accent hover:bg-accent-soft"
            aria-label="Re-sync region"
          >
            <RefreshCw size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(region.id)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-black/5"
          aria-label="Delete region"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
