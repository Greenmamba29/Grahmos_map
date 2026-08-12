import { useEffect, useState } from "react";
import clsx from "clsx";
import type { Facility } from "@/data/types";
import { getQueuedStatusReports } from "@/data/facilities";

const TABS = ["Overview", "Capacity", "Resources", "Updates"] as const;
type Tab = (typeof TABS)[number];

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function PoiTabs({ facility }: { facility: Facility }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    getQueuedStatusReports().then((reports) =>
      setQueuedCount(reports.filter((r) => r.facilityId === facility.id).length),
    );
  }, [facility.id]);

  return (
    <div>
      <div className="mb-3 flex gap-4 border-b border-black/5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="space-y-2 text-sm text-ink">
          {facility.address && <p className="text-ink-muted">{facility.address}</p>}
          {facility.description && <p>{facility.description}</p>}
          <p className="text-xs text-ink-faint">
            Last verified {formatRelativeTime(facility.lastUpdated)}
          </p>
        </div>
      )}

      {tab === "Capacity" && (
        <div className="space-y-3 text-sm">
          {facility.capacity ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-ink-muted">Current occupancy</span>
                <span className="font-semibold text-ink">
                  {facility.occupancy ?? "—"} / {facility.capacity} {facility.capacityUnit}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.min(
                      100,
                      ((facility.occupancy ?? 0) / facility.capacity) * 100,
                    )}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-ink-muted">No capacity data reported for this facility.</p>
          )}
        </div>
      )}

      {tab === "Resources" && (
        <div className="flex flex-wrap gap-2">
          {facility.resources.length === 0 && (
            <p className="text-sm text-ink-muted">No resources listed.</p>
          )}
          {facility.resources.map((resource) => (
            <span
              key={resource}
              className="rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-medium text-ink"
            >
              {resource}
            </span>
          ))}
        </div>
      )}

      {tab === "Updates" && (
        <div className="space-y-2 text-sm">
          <p className="text-ink-muted">
            Status last updated {formatRelativeTime(facility.lastUpdated)}.
          </p>
          {queuedCount > 0 && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium text-accent">
              {queuedCount} report{queuedCount > 1 ? "s" : ""} queued locally — will sync when
              back online.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
