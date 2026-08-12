import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/ui/Button";
import { STATUS_META, type Facility, type FacilityStatus } from "@/data/types";
import { submitStatusReport } from "@/data/facilities";
import { useIsOnline } from "@/network/NetworkStatusProvider";

interface ReportStatusModalProps {
  facility: Facility;
  onClose: () => void;
}

const STATUS_ORDER: FacilityStatus[] = ["operational", "limited", "offline", "unknown"];

export function ReportStatusModal({ facility, onClose }: ReportStatusModalProps) {
  const [status, setStatus] = useState<FacilityStatus>(facility.status);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"synced" | "queued" | null>(null);
  const isOnline = useIsOnline();

  async function handleSubmit() {
    setSubmitting(true);
    const { synced } = await submitStatusReport({
      facilityId: facility.id,
      reportedStatus: status,
      note: note.trim() || undefined,
    });
    setSubmitting(false);
    setResult(synced ? "synced" : "queued");
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-sheet animate-slide-up sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Report status</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-ink">
              {result === "synced"
                ? "Thanks — your report was sent."
                : "You're offline. Your report is queued and will sync automatically."}
            </p>
            <Button fullWidth onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">{facility.name}</p>

            <div className="grid grid-cols-2 gap-2">
              {STATUS_ORDER.map((s) => {
                const meta = STATUS_META[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className="rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      borderColor: active ? meta.color : "rgba(0,0,0,0.1)",
                      backgroundColor: active ? meta.bg : "white",
                      color: active ? meta.color : "#1F1F1F",
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={3}
              className="w-full resize-none rounded-xl border border-black/10 p-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />

            {!isOnline && (
              <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium text-accent">
                You're offline — this report will be queued and synced automatically later.
              </p>
            )}

            <Button fullWidth onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit report"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
