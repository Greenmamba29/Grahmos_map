import { CloudUpload, UserRound } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import { STATUS_META } from '@/lib/taxonomy';
import type { FacilityUpdate } from '@/types';

interface UpdateFeedProps {
  updates: FacilityUpdate[];
  loading: boolean;
}

export function UpdateFeed({ updates, loading }: UpdateFeedProps) {
  if (loading) {
    return <p className="px-1 py-3 text-[14px] text-ink-muted">Loading field reports…</p>;
  }

  if (updates.length === 0) {
    return (
      <p className="rounded-2xl bg-canvas px-4 py-3 text-[14px] text-ink-muted">
        No field reports yet. Use “Report status” to log what you can see on the ground.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {updates.map((update) => {
        const status = STATUS_META[update.status];
        return (
          <li key={update.clientId} className="rounded-2xl border border-hairline p-3.5">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium"
                style={{ backgroundColor: status.softColor, color: status.color }}
              >
                {status.label}
              </span>
              <span className="text-[12.5px] text-ink-muted">
                {formatRelativeTime(update.reportedAt)}
              </span>
              {update.pending && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-medium text-primary-dark">
                  <CloudUpload size={12} strokeWidth={2.2} />
                  Queued
                </span>
              )}
            </div>

            {update.message && (
              <p className="mt-2 text-[14px] leading-snug text-ink">{update.message}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
              {update.reporter && (
                <span className="inline-flex items-center gap-1">
                  <UserRound size={12} strokeWidth={2} />
                  {update.reporter}
                </span>
              )}
              {update.capacity !== undefined && <span>Capacity {update.capacity}</span>}
              {update.occupancy !== undefined && <span>Occupancy {update.occupancy}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
