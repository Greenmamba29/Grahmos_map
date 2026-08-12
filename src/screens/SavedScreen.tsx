import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Navigation } from 'lucide-react';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { useFacilities } from '@/hooks/useFacilities';
import { useSavedFacilities } from '@/hooks/useSavedFacilities';
import { formatDistance, formatRelativeTime } from '@/lib/format';
import { categoryMeta, STATUS_META } from '@/lib/taxonomy';
import { useSession } from '@/state/session';

/** Saved facilities. Reads from IndexedDB, so it is fully available offline. */
export function SavedScreen() {
  const navigate = useNavigate();
  const { all } = useFacilities();
  const { savedIds, toggleSaved } = useSavedFacilities();
  const selectFacility = useSession((state) => state.selectFacility);
  const setRouteTarget = useSession((state) => state.setRouteTarget);

  const saved = useMemo(
    () =>
      all
        .filter((facility) => savedIds.includes(facility.id))
        .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)),
    [all, savedIds],
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <ScreenHeader
        title="Saved"
        subtitle={`${saved.length} facilit${saved.length === 1 ? 'y' : 'ies'} on this device`}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {saved.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline px-4 py-10 text-center">
            <Bookmark size={24} strokeWidth={2} className="mx-auto text-ink-muted" />
            <p className="mt-2 text-[14px] font-medium text-ink">Nothing saved yet</p>
            <p className="mx-auto mt-1 max-w-[38ch] text-[13px] leading-snug text-ink-muted">
              Save the sites you rely on. Saved facilities stay available with no
              connectivity, including their last known status.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {saved.map((facility) => {
              const meta = categoryMeta(facility.category);
              const status = STATUS_META[facility.status];
              const Icon = meta.icon;
              return (
                <li key={facility.id} className="rounded-2xl border border-hairline p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Icon size={19} strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          selectFacility(facility);
                          navigate('/');
                        }}
                        className="block max-w-full truncate text-left text-[15.5px] font-medium text-ink"
                      >
                        {facility.name}
                      </button>
                      <p className="mt-0.5 text-[13px]">
                        <span style={{ color: status.color }}>{status.label}</span>
                        <span className="text-ink-muted">
                          {' '}
                          · {formatDistance(facility.distanceM)} ·{' '}
                          {formatRelativeTime(facility.verifiedAt ?? facility.lastUpdated)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleSaved(facility.id)}
                      aria-label={`Remove ${facility.name} from saved`}
                      className="tap-target grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary hover:bg-primary-soft"
                    >
                      <Bookmark size={17} strokeWidth={2.2} className="fill-current" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRouteTarget(facility);
                      navigate('/routes');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3.5 py-2 text-[13.5px] font-medium text-primary-dark"
                  >
                    <Navigation size={15} strokeWidth={2.2} className="fill-current" />
                    Directions
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
