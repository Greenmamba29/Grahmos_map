import { useState } from "react";
import { useAppStore } from "../../store/appStore";
import { Icon } from "../ui/Icon";
import { formatMb, timeAgo } from "../../utils/format";
import type { OfflineRegion } from "../../types";

const STATE_META: Record<
  OfflineRegion["state"],
  { icon: string; color: string; label: string }
> = {
  downloaded: { icon: "check", color: "#188038", label: "Downloaded" },
  updating: { icon: "refresh", color: "#1a73e8", label: "Updating…" },
  "update-available": { icon: "warning", color: "#f29900", label: "Update available" },
  downloading: { icon: "download", color: "#1a73e8", label: "Downloading…" },
};

export function RegionCard({ region }: { region: OfflineRegion }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const updateRegion = useAppStore((s) => s.updateRegion);
  const removeRegion = useAppStore((s) => s.removeRegion);
  const meta = STATE_META[region.state];

  const update = () => {
    setMenuOpen(false);
    updateRegion(region.id, { state: "updating" });
    setTimeout(() => {
      updateRegion(region.id, {
        state: "downloaded",
        downloadedAt: new Date().toISOString(),
      });
    }, 2500);
  };

  return (
    <div className="relative flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
      {/* Status icon / progress ring */}
      <span
        className="grid size-11 shrink-0 place-items-center rounded-full"
        style={{ background: `${meta.color}1a`, color: meta.color }}
      >
        {region.state === "downloading" && region.progress != null ? (
          <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#e8eaed" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#1a73e8"
              strokeWidth="4"
              strokeDasharray={`${region.progress * 94.2} 94.2`}
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <Icon
            name={meta.icon}
            size={20}
            className={region.state === "updating" ? "animate-spin" : ""}
          />
        )}
      </span>

      <div className="min-w-0 grow">
        <p className="truncate font-medium">{region.name}</p>
        <p className="text-xs text-ink-soft">
          {formatMb(region.sizeMb)} · {region.facilityCount} facilities ·{" "}
          {region.state === "downloading"
            ? `${Math.round((region.progress ?? 0) * 100)}%`
            : `updated ${timeAgo(region.downloadedAt)}`}
        </p>
        <p className="text-xs font-medium" style={{ color: meta.color }}>
          {meta.label}
        </p>
      </div>

      <button
        aria-label="Region options"
        onClick={() => setMenuOpen(!menuOpen)}
        className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-gray-100"
      >
        <Icon name="moreVert" size={18} />
      </button>

      {menuOpen && (
        <>
          <button
            className="fixed inset-0 z-10"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-3 top-12 z-20 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-[var(--shadow-float)]">
            <button
              onClick={update}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50"
            >
              <Icon name="refresh" size={16} className="text-ink-soft" />
              Update now
            </button>
            <button
              onClick={() => removeRegion(region.id)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-down hover:bg-gray-50"
            >
              <Icon name="delete" size={16} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
