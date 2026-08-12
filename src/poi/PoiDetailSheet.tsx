import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "@/ui/BottomSheet";
import { CATEGORY_META, type Facility } from "@/data/types";
import { StatusPill } from "./StatusPill";
import { ActionPillRow } from "./ActionPillRow";
import { PoiTabs } from "./PoiTabs";
import { ReportStatusModal } from "@/report/ReportStatusModal";
import { useSavedFacilities } from "@/store/useSavedFacilities";

interface PoiDetailSheetProps {
  facility: Facility | null;
  onClose: () => void;
}

export function PoiDetailSheet({ facility, onClose }: PoiDetailSheetProps) {
  const navigate = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);
  const isSaved = useSavedFacilities((s) => (facility ? s.savedIds.includes(facility.id) : false));
  const toggleSaved = useSavedFacilities((s) => s.toggle);

  if (!facility) return null;
  const meta = CATEGORY_META[facility.category];

  return (
    <>
      <BottomSheet open={Boolean(facility)} onClose={onClose}>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium" style={{ color: meta.color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </div>
            <h2 className="text-xl font-semibold text-ink">{facility.name}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusPill status={facility.status} />
              {facility.address && (
                <span className="truncate text-sm text-ink-muted">{facility.address}</span>
              )}
            </div>
          </div>

          <ActionPillRow
            onDirections={() => navigate(`/routes?to=${facility.id}`)}
            onReportStatus={() => setReportOpen(true)}
            onSave={() => toggleSaved(facility.id)}
            onCall={() => facility.contactPhone && (window.location.href = `tel:${facility.contactPhone}`)}
            saved={isSaved}
            hasPhone={Boolean(facility.contactPhone)}
          />

          <PoiTabs facility={facility} />
        </div>
      </BottomSheet>

      {reportOpen && (
        <ReportStatusModal facility={facility} onClose={() => setReportOpen(false)} />
      )}
    </>
  );
}
