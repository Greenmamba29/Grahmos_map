import { useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore";
import { CATEGORY_META, STATUS_META } from "../../config";
import { haversineKm, loadReports } from "../../data/facilitiesRepo";
import { timeAgo, formatDistance } from "../../utils/format";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/Tabs";
import { ReportStatusModal } from "./ReportStatusModal";
import { env } from "../../config";
import type { FacilityReport } from "../../types";

type PoiTab = "overview" | "capacity" | "resources" | "updates";

const RESOURCE_LABELS: Record<string, string> = {
  water: "Potable water",
  generator: "Backup power / generator",
  medical: "Medical supplies",
  radio: "Radio / communications",
  food: "Food distribution",
  accessible: "Wheelchair accessible",
};

/**
 * Pattern 4 — POI bottom card: header, action pills
 * (Directions / Report Status / Save / Call) and Overview / Capacity /
 * Resources / Updates tabs. Peek by default, tap header to expand.
 */
export function PoiSheet() {
  const facility = useAppStore((s) =>
    s.facilities.find((f) => f.id === s.selectedFacilityId),
  );
  const selectFacility = useAppStore((s) => s.selectFacility);
  const startRoute = useAppStore((s) => s.startRoute);
  const savedIds = useAppStore((s) => s.savedIds);
  const toggleSaved = useAppStore((s) => s.toggleSaved);
  const userLocation = useAppStore((s) => s.userLocation);

  const [tab, setTab] = useState<PoiTab>("overview");
  const [expanded, setExpanded] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reports, setReports] = useState<FacilityReport[]>([]);

  useEffect(() => {
    setTab("overview");
    setExpanded(false);
    if (facility) void loadReports(facility.id).then(setReports);
  }, [facility?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!facility) return null;

  const meta = CATEGORY_META[facility.category];
  const status = STATUS_META[facility.status];
  const saved = savedIds.includes(facility.id);
  const origin = userLocation ?? {
    lng: env.defaultCenter[0],
    lat: env.defaultCenter[1],
  };
  const distanceKm = haversineKm(origin, facility);

  return (
    <>
      <div
        className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 mx-auto max-w-xl rounded-t-2xl bg-white shadow-[var(--shadow-sheet)] animate-sheet-up transition-[max-height] ${
          expanded ? "max-h-[72dvh]" : "max-h-[300px]"
        } flex flex-col`}
      >
        {/* Grabber + close */}
        <button
          className="flex w-full items-center justify-center pt-2.5 pb-1"
          aria-label={expanded ? "Collapse details" : "Expand details"}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="h-1 w-9 rounded-full bg-line" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pb-3">
          <button className="min-w-0 grow text-left" onClick={() => setExpanded(!expanded)}>
            <h2 className="truncate text-xl font-medium leading-tight">
              {facility.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span
                className="inline-flex items-center gap-1 font-medium"
                style={{ color: meta.color }}
              >
                <Icon name={meta.icon} size={13} />
                {meta.label.replace(/s$/, "")}
              </span>
              <span className="text-ink-soft">·</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ color: status.color, background: status.bg }}
              >
                {status.label}
              </span>
              <span className="text-ink-soft">·</span>
              <span className="text-ink-soft">
                {formatDistance(distanceKm)} · verified {timeAgo(facility.lastUpdated)}
              </span>
            </div>
            {facility.statusNote && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warn">
                <Icon name="warning" size={12} />
                {facility.statusNote}
              </p>
            )}
          </button>
          <button
            aria-label="Close details"
            onClick={() => selectFacility(null)}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 text-ink-soft"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Action pills */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3">
          <button
            onClick={() => startRoute(facility.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="directions" size={16} />
            Directions
          </button>
          <button
            onClick={() => setReporting(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-primary"
          >
            <Icon name="flag" size={16} />
            Report Status
          </button>
          <button
            onClick={() => void toggleSaved(facility.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium ${
              saved
                ? "border-primary bg-primary-soft text-primary"
                : "border-line bg-white text-primary"
            }`}
          >
            <Icon name={saved ? "star" : "bookmark"} size={16} />
            {saved ? "Saved" : "Save"}
          </button>
          {facility.phone && (
            <a
              href={`tel:${facility.phone}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-primary"
            >
              <Icon name="phone" size={16} />
              Call
            </a>
          )}
        </div>

        {/* Tabs */}
        <Tabs<PoiTab>
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "capacity", label: "Capacity" },
            { id: "resources", label: "Resources" },
            { id: "updates", label: "Updates" },
          ]}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setExpanded(true);
          }}
        />

        <div className="grow overflow-y-auto overscroll-contain px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-3 text-sm">
              {facility.address && (
                <Row icon="map" label="Address" value={facility.address} />
              )}
              {facility.operator && (
                <Row icon="shelter" label="Operated by" value={facility.operator} />
              )}
              <Row
                icon="clock"
                label="Last verified"
                value={`${timeAgo(facility.lastUpdated)}${
                  facility.verifiedBy ? ` by ${facility.verifiedBy}` : ""
                }`}
              />
              {facility.notes && (
                <p className="rounded-xl bg-gray-50 p-3 text-[13px] leading-relaxed text-ink-soft">
                  {facility.notes}
                </p>
              )}
            </div>
          )}

          {tab === "capacity" && (
            <div className="space-y-4">
              {facility.capacity ? (
                <>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">Occupancy</span>
                      <span className="text-ink-soft">
                        {facility.occupancy ?? "?"} / {facility.capacity}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            ((facility.occupancy ?? 0) / facility.capacity) * 100,
                          )}%`,
                          background:
                            (facility.occupancy ?? 0) / facility.capacity > 0.9
                              ? "#d93025"
                              : (facility.occupancy ?? 0) / facility.capacity > 0.7
                                ? "#f29900"
                                : "#188038",
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-ink-soft">
                    Total capacity: {facility.capacity.toLocaleString()} people
                    {facility.occupancy != null &&
                      ` · ${Math.max(0, facility.capacity - facility.occupancy).toLocaleString()} spots estimated free`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-soft">
                  No capacity data recorded for this facility.
                </p>
              )}
            </div>
          )}

          {tab === "resources" && (
            <ul className="space-y-2.5">
              {Object.entries(RESOURCE_LABELS).map(([key, label]) => {
                const available = Boolean(
                  facility.resources[key as keyof typeof facility.resources],
                );
                return (
                  <li key={key} className="flex items-center gap-3 text-sm">
                    <span
                      className={`grid size-6 place-items-center rounded-full ${
                        available
                          ? "bg-[#e6f4ea] text-ok"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Icon name={available ? "check" : "close"} size={13} />
                    </span>
                    <span className={available ? "" : "text-ink-soft line-through"}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "updates" && (
            <ul className="space-y-4">
              {reports.length === 0 && (
                <p className="text-sm text-ink-soft">No status reports yet.</p>
              )}
              {reports.map((r) => {
                const s = STATUS_META[r.status];
                return (
                  <li key={r.id} className="flex gap-3">
                    <span
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
                      style={{ background: s.bg, color: s.color }}
                    >
                      <Icon name="flag" size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold" style={{ color: s.color }}>
                          {s.label}
                        </span>
                        <span className="text-ink-soft">
                          {" "}
                          · {r.reporter ?? "Anonymous"} · {timeAgo(r.createdAt)}
                        </span>
                      </p>
                      {r.note && (
                        <p className="text-[13px] text-ink-soft">{r.note}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {reporting && (
        <ReportStatusModal facility={facility} onClose={() => setReporting(false)} />
      )}
    </>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 text-ink-soft">
        <Icon name={icon} size={15} />
      </span>
      <div>
        <p className="text-xs text-ink-soft">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
