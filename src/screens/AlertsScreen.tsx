import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  CloudUpload,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { useFacilities } from '@/hooks/useFacilities';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { alertStore, outboxStore } from '@/lib/db';
import { flushOutbox } from '@/lib/outbox';
import { formatRelativeTime, hoursSince } from '@/lib/format';
import { HAZARD_LABELS, hazardColor } from '@/lib/taxonomy';
import type { AlertItem, FacilityUpdate } from '@/types';

async function readAlertState(): Promise<{ queued: FacilityUpdate[]; logged: AlertItem[] }> {
  const [queued, stored] = await Promise.all([outboxStore.all(), alertStore.all()]);
  const logged = [...stored]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30);
  return { queued, logged };
}

/**
 * Alerts: hazard reports, facilities whose status has gone stale, and the outbox of
 * field reports still waiting to sync.
 */
export function AlertsScreen() {
  const online = useOnlineStatus();
  const { hazards, all } = useFacilities();
  const [queued, setQueued] = useState<FacilityUpdate[]>([]);
  const [logged, setLogged] = useState<AlertItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    const { queued: nextQueued, logged: nextLogged } = await readAlertState();
    setQueued(nextQueued);
    setLogged(nextLogged);
  }, []);

  useEffect(() => {
    void readAlertState().then(({ queued: nextQueued, logged: nextLogged }) => {
      setQueued(nextQueued);
      setLogged(nextLogged);
    });
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      await flushOutbox();
      await reload();
    } finally {
      setSyncing(false);
    }
  };

  const stale = all
    .filter((facility) => hoursSince(facility.verifiedAt) > 24)
    .sort((a, b) => hoursSince(b.verifiedAt) - hoursSince(a.verifiedAt))
    .slice(0, 6);

  return (
    <div className="flex h-full flex-col bg-white">
      <ScreenHeader
        title="Alerts"
        subtitle={online ? 'Live hazard and status feed' : 'Offline — showing stored alerts'}
        action={
          queued.length > 0 ? (
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing || !online}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                strokeWidth={2.4}
                className={syncing ? 'animate-spin' : undefined}
              />
              Sync
            </button>
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {queued.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Waiting to sync ({queued.length})
            </h2>
            <ul className="space-y-2">
              {queued.map((update) => (
                <li
                  key={update.clientId}
                  className="flex items-start gap-2.5 rounded-2xl bg-primary-soft px-4 py-3"
                >
                  <CloudUpload
                    size={16}
                    strokeWidth={2.2}
                    className="mt-0.5 shrink-0 text-primary-dark"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ink">
                      Status report · {update.status}
                    </p>
                    <p className="text-[12.5px] text-ink-muted">
                      {update.message ?? 'No note'} · {formatRelativeTime(update.reportedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {!online && (
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                <WifiOff size={13} strokeWidth={2.2} />
                These upload automatically when a connection returns.
              </p>
            )}
          </section>
        )}

        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Active hazards ({hazards.length})
          </h2>
          {hazards.length === 0 ? (
            <p className="rounded-2xl bg-canvas px-4 py-3 text-[13.5px] text-ink-muted">
              No active hazards recorded.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...hazards]
                .sort((a, b) => b.severity - a.severity)
                .map((hazard) => (
                  <li key={hazard.id} className="rounded-2xl border border-hairline px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <TriangleAlert
                        size={16}
                        strokeWidth={2.2}
                        style={{ color: hazardColor(hazard.severity) }}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-medium text-ink">
                          {HAZARD_LABELS[hazard.kind]}
                          <span className="ml-2 text-[12px] font-normal text-ink-muted">
                            severity {hazard.severity}/5
                          </span>
                        </p>
                        {hazard.description && (
                          <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
                            {hazard.description}
                          </p>
                        )}
                        <p className="mt-1 text-[12px] text-ink-muted">
                          Reported {formatRelativeTime(hazard.reportedAt)}
                          {hazard.expiresAt &&
                            ` · review ${formatRelativeTime(hazard.expiresAt)}`}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {stale.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Needs verification
            </h2>
            <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
              {stale.map((facility) => (
                <li key={facility.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] text-ink">{facility.name}</span>
                    <span className="text-[12.5px] text-ink-muted">
                      {facility.verifiedAt
                        ? `Verified ${formatRelativeTime(facility.verifiedAt)}`
                        : 'Never verified'}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-1 text-[11.5px] font-medium text-ink">
                    Stale
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Activity
          </h2>
          {logged.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline px-4 py-8 text-center">
              <Bell size={22} strokeWidth={2} className="mx-auto text-ink-muted" />
              <p className="mt-2 text-[13.5px] text-ink-muted">
                Sync events and submitted reports appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {logged.map((alert) => (
                <li key={alert.id} className="rounded-2xl border border-hairline px-4 py-3">
                  <p className="text-[14px] font-medium text-ink">{alert.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
                    {alert.body} · {formatRelativeTime(alert.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
