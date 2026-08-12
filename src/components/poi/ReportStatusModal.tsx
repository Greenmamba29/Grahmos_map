import { useState } from "react";
import { STATUS_META } from "../../config";
import { submitReport } from "../../data/facilitiesRepo";
import { useAppStore } from "../../store/appStore";
import { Icon } from "../ui/Icon";
import type { Facility, FacilityStatus } from "../../types";

const CHOICES: FacilityStatus[] = ["operational", "degraded", "down"];

interface Props {
  facility: Facility;
  onClose: () => void;
}

/** Crowd-report modal; queues to the IndexedDB outbox when offline. */
export function ReportStatusModal({ facility, onClose }: Props) {
  const [status, setStatus] = useState<FacilityStatus>(facility.status);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<"sent" | "queued" | null>(null);
  const setFacilities = useAppStore((s) => s.setFacilities);
  const facilities = useAppStore((s) => s.facilities);

  const submit = async () => {
    const { queued } = await submitReport({
      facilityId: facility.id,
      status,
      note: note || undefined,
      reporter: "You",
    });
    // Optimistically reflect the report locally.
    setFacilities(
      facilities.map((f) =>
        f.id === facility.id
          ? {
              ...f,
              status,
              statusNote: note || f.statusNote,
              lastUpdated: new Date().toISOString(),
            }
          : f,
      ),
    );
    setResult(queued ? "queued" : "sent");
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl animate-sheet-up">
        {result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
              <Icon name={result === "sent" ? "check" : "clock"} size={24} />
            </span>
            <p className="font-medium">
              {result === "sent"
                ? "Status report sent"
                : "Saved — will sync when back online"}
            </p>
          </div>
        ) : (
          <>
            <h3 className="mb-1 text-lg font-medium">Report status</h3>
            <p className="mb-4 text-sm text-ink-soft">{facility.name}</p>
            <div className="mb-4 flex gap-2">
              {CHOICES.map((c) => {
                const meta = STATUS_META[c];
                const active = status === c;
                return (
                  <button
                    key={c}
                    onClick={() => setStatus(c)}
                    className={`flex-1 rounded-xl border-2 px-2 py-2.5 text-sm font-medium transition-colors ${
                      active ? "border-current" : "border-line text-ink-soft"
                    }`}
                    style={active ? { color: meta.color, background: meta.bg } : undefined}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you observe? (optional)"
              rows={3}
              className="mb-4 w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
