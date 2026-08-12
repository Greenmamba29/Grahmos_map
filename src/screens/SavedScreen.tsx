import { useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { useFacilities } from "@/data/useFacilities";
import { useSavedFacilities } from "@/store/useSavedFacilities";
import { CATEGORY_META } from "@/data/types";
import { StatusPill } from "@/poi/StatusPill";

export function SavedScreen() {
  const { facilities } = useFacilities();
  const savedIds = useSavedFacilities((s) => s.savedIds);
  const navigate = useNavigate();
  const saved = facilities.filter((f) => savedIds.includes(f.id));

  return (
    <div className="h-full overflow-y-auto bg-[#F5F5F3] p-4 pb-24">
      <h1 className="mb-4 text-2xl font-semibold text-ink">Saved</h1>

      {saved.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-8 text-center shadow-floating">
          <Bookmark size={28} className="text-ink-faint" />
          <p className="text-sm text-ink-muted">
            Facilities you save will show up here for quick access — even offline.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {saved.map((facility) => {
            const meta = CATEGORY_META[facility.category];
            return (
              <button
                key={facility.id}
                type="button"
                onClick={() => navigate(`/?poi=${facility.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-floating"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: meta.color }}
                >
                  <Bookmark size={16} fill="white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {facility.name}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {meta.label}
                    {facility.address ? ` · ${facility.address}` : ""}
                  </span>
                </span>
                <StatusPill status={facility.status} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
