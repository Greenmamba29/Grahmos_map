import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BottomSheet, type SheetSnap } from '@/components/ui/BottomSheet';
import { ActionPills } from '@/components/facility/ActionPills';
import { CapacityBar } from '@/components/facility/CapacityBar';
import { ResourceList } from '@/components/facility/ResourceList';
import { StatusRow } from '@/components/facility/StatusRow';
import { UpdateFeed } from '@/components/facility/UpdateFeed';
import { loadFacilityUpdates } from '@/lib/facilities';
import { cn } from '@/lib/cn';
import { categoryMeta } from '@/lib/taxonomy';
import type { Facility, FacilityUpdate } from '@/types';

type TabId = 'overview' | 'capacity' | 'resources' | 'updates';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'resources', label: 'Resources' },
  { id: 'updates', label: 'Updates' },
];

interface FacilitySheetProps {
  facility: Facility | null;
  saved: boolean;
  onClose: () => void;
  onDirections: (facility: Facility) => void;
  onReport: (facility: Facility) => void;
  onSave: (facility: Facility) => void;
  /** Bumped after a report is submitted so the feed refetches. */
  refreshKey?: number;
}

/** The POI detail card: title, status row, action pills and content tabs. */
export function FacilitySheet({
  facility,
  saved,
  onClose,
  onDirections,
  onReport,
  onSave,
  refreshKey = 0,
}: FacilitySheetProps) {
  // Keyed by facility id at the call site, so a different facility remounts the
  // sheet and these start from their initial values.
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [tab, setTab] = useState<TabId>('overview');
  const [updates, setUpdates] = useState<FacilityUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  useEffect(() => {
    if (!facility) return;
    let cancelled = false;
    void loadFacilityUpdates(facility.id).then((result) => {
      if (cancelled) return;
      setUpdates(result);
      setLoadingUpdates(false);
    });
    return () => {
      cancelled = true;
    };
  }, [facility, refreshKey]);

  if (!facility) return null;

  const meta = categoryMeta(facility.category);
  const Icon = meta.icon;

  return (
    <BottomSheet
      open
      onClose={onClose}
      label={facility.name}
      snap={snap}
      onSnapChange={setSnap}
      showScrim={false}
    >
      <div className="px-4 pb-6">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
            style={{ backgroundColor: meta.color }}
          >
            <Icon size={20} strokeWidth={2.2} />
          </span>
          <h2 className="min-w-0 flex-1 text-[21px] font-semibold leading-tight text-ink">
            {facility.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap-target -mr-2 -mt-1 grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-canvas"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-3">
          <StatusRow facility={facility} />
        </div>

        <div className="mt-4">
          <ActionPills
            facility={facility}
            saved={saved}
            onDirections={() => onDirections(facility)}
            onReport={() => onReport(facility)}
            onSave={() => onSave(facility)}
          />
        </div>

        <div
          role="tablist"
          aria-label="Facility details"
          className="no-scrollbar mt-5 -mx-4 flex gap-1 overflow-x-auto border-b border-hairline px-4"
        >
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  if (snap === 'peek') setSnap('half');
                }}
                className={cn(
                  'relative shrink-0 px-3 pb-2.5 pt-1 text-[14px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-4">
          {tab === 'overview' && (
            <>
              {facility.notes ? (
                <p className="text-[14.5px] leading-relaxed text-ink">{facility.notes}</p>
              ) : (
                <p className="text-[14.5px] text-ink-muted">
                  No operational notes recorded for this site.
                </p>
              )}
              <CapacityBar facility={facility} />
              <dl className="grid grid-cols-2 gap-3">
                <Fact label="Category" value={meta.label} />
                <Fact
                  label="Coordinates"
                  value={`${facility.lat.toFixed(4)}, ${facility.lng.toFixed(4)}`}
                />
                {facility.contactPhone && <Fact label="Phone" value={facility.contactPhone} />}
                <Fact label="Facility ID" value={facility.id} />
              </dl>
            </>
          )}

          {tab === 'capacity' && (
            <>
              <CapacityBar facility={facility} />
              <p className="text-[13.5px] leading-relaxed text-ink-muted">
                Capacity figures come from the most recent field report. Submit a
                report to correct them — the change is stored locally straight away
                and syncs when the network allows.
              </p>
            </>
          )}

          {tab === 'resources' && <ResourceList facility={facility} />}

          {tab === 'updates' && <UpdateFeed updates={updates} loading={loadingUpdates} />}
        </div>
      </div>
    </BottomSheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-canvas px-3.5 py-2.5">
      <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[14px] text-ink">{value}</dd>
    </div>
  );
}
