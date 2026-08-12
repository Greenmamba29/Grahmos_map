import { alertStore, outboxStore, updateStore } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { FacilityStatus, FacilityUpdate } from '@/types';

/**
 * Offline write path. Reports are always written locally first, then replayed.
 * `client_id` is unique in Postgres, so a replay after a partial failure cannot
 * duplicate a report.
 */

export interface ReportDraft {
  facilityId: string;
  facilityName: string;
  status: FacilityStatus;
  capacity?: number;
  occupancy?: number;
  message?: string;
  reporter?: string;
}

function newClientId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitReport(draft: ReportDraft): Promise<FacilityUpdate> {
  const clientId = newClientId();
  const update: FacilityUpdate = {
    id: clientId,
    facilityId: draft.facilityId,
    status: draft.status,
    capacity: draft.capacity,
    occupancy: draft.occupancy,
    message: draft.message,
    reporter: draft.reporter ?? 'Field team',
    reportedAt: new Date().toISOString(),
    clientId,
    pending: true,
  };

  await outboxStore.add(update);
  await alertStore.put([
    {
      id: `alert-${clientId}`,
      kind: 'sync',
      title: `Status report queued — ${draft.facilityName}`,
      body: navigator.onLine
        ? 'Sending now.'
        : 'Saved on this device. It will sync automatically when a connection returns.',
      severity: 'info',
      at: update.reportedAt,
      facilityId: draft.facilityId,
    },
  ]);

  if (navigator.onLine) void flushOutbox();
  return update;
}

let flushing = false;

export async function flushOutbox(): Promise<{ sent: number; remaining: number }> {
  if (flushing) return { sent: 0, remaining: (await outboxStore.all()).length };
  flushing = true;

  try {
    const queued = await outboxStore.all();
    if (queued.length === 0) return { sent: 0, remaining: 0 };

    if (!supabase || !navigator.onLine) {
      return { sent: 0, remaining: queued.length };
    }

    let sent = 0;
    for (const update of queued) {
      try {
        const { error } = await supabase.from('facility_updates').insert({
          facility_id: update.facilityId,
          status: update.status,
          capacity: update.capacity ?? null,
          occupancy: update.occupancy ?? null,
          message: update.message ?? null,
          reporter: update.reporter ?? null,
          reported_at: update.reportedAt,
          client_id: update.clientId,
        });

        // A duplicate key means a previous attempt already landed: treat as sent.
        const alreadyStored = error?.code === '23505';
        if (error && !alreadyStored) throw error;

        await outboxStore.remove(update.clientId);
        await updateStore.put([{ ...update, pending: false }]);
        sent += 1;
      } catch (error) {
        console.warn('[outbox] replay failed, leaving report queued', error);
        break;
      }
    }

    const remaining = (await outboxStore.all()).length;
    if (sent > 0) {
      await alertStore.put([
        {
          id: `alert-sync-${Date.now()}`,
          kind: 'sync',
          title: `${sent} report${sent === 1 ? '' : 's'} synced`,
          body: remaining > 0 ? `${remaining} still queued.` : 'All local reports are up to date.',
          severity: 'info',
          at: new Date().toISOString(),
        },
      ]);
    }
    return { sent, remaining };
  } finally {
    flushing = false;
  }
}

/** Replay queued reports whenever connectivity returns. */
export function startOutboxSync(): () => void {
  const onOnline = () => void flushOutbox();
  window.addEventListener('online', onOnline);
  if (navigator.onLine) void flushOutbox();
  return () => window.removeEventListener('online', onOnline);
}
