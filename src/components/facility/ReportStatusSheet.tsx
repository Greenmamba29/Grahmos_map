import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { submitReport } from '@/lib/outbox';
import { STATUS_META } from '@/lib/taxonomy';
import type { Facility, FacilityStatus } from '@/types';

interface ReportStatusSheetProps {
  facility: Facility | null;
  open: boolean;
  online: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const STATUS_OPTIONS: Array<{ value: FacilityStatus; label: string }> = [
  { value: 'open', label: STATUS_META.open.label },
  { value: 'limited', label: STATUS_META.limited.label },
  { value: 'closed', label: STATUS_META.closed.label },
];

/**
 * Field report form. The submit path is offline-first by design: the report lands
 * in the local outbox first and syncs later, so a responder never loses an
 * observation because the network was down when they made it.
 */
export function ReportStatusSheet({
  facility,
  open,
  online,
  onClose,
  onSubmitted,
}: ReportStatusSheetProps) {
  // Seeded from the facility's current values; the call site keys this component by
  // facility id so opening a different site re-seeds the form.
  const [status, setStatus] = useState<FacilityStatus>(
    facility && facility.status !== 'unknown' ? facility.status : 'open',
  );
  const [occupancy, setOccupancy] = useState(
    facility?.occupancy !== undefined ? String(facility.occupancy) : '',
  );
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!facility) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitReport({
        facilityId: facility.id,
        facilityName: facility.name,
        status,
        occupancy: occupancy.trim() === '' ? undefined : Number.parseInt(occupancy, 10),
        message: message.trim() === '' ? undefined : message.trim(),
      });
      onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={`Report status for ${facility.name}`}
      snap="half"
      snapPoints={['half', 'full']}
    >
      <div className="px-4 pb-6">
        <h2 className="pt-1 text-[17px] font-semibold text-ink">Report status</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-muted">{facility.name}</p>

        <div className="mt-5 space-y-5">
          <div>
            <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Current status
            </label>
            <SegmentedControl
              label="Current status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />
          </div>

          <div>
            <label
              htmlFor="report-occupancy"
              className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-ink-muted"
            >
              People or beds in use
            </label>
            <input
              id="report-occupancy"
              type="number"
              inputMode="numeric"
              min={0}
              value={occupancy}
              onChange={(event) => setOccupancy(event.target.value)}
              placeholder={facility.capacity ? `of ${facility.capacity}` : 'Optional'}
              className="w-full rounded-2xl border border-hairline px-4 py-3 text-[15px] text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="report-message"
              className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-ink-muted"
            >
              What did you observe?
            </label>
            <textarea
              id="report-message"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Access route, supplies needed, damage, staffing…"
              className="w-full resize-none rounded-2xl border border-hairline px-4 py-3 text-[15px] text-ink outline-none focus:border-primary"
            />
          </div>

          {!online && (
            <p className="flex items-start gap-2 rounded-2xl bg-warning-soft px-3.5 py-3 text-[13px] leading-snug text-ink">
              <WifiOff size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" />
              You are offline. This report is saved on the device and uploads
              automatically once a connection returns.
            </p>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-hairline bg-white px-4 py-3 pb-safe">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="w-full rounded-full bg-primary py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {submitting ? 'Saving…' : online ? 'Submit report' : 'Save report for later'}
        </button>
      </div>
    </BottomSheet>
  );
}
