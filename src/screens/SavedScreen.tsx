import { useAppStore } from "../store/appStore";
import { CATEGORY_META, STATUS_META } from "../config";
import { Icon } from "../components/ui/Icon";
import { timeAgo } from "../utils/format";
import { mapRef } from "../map/mapInstance";

/** Saved facilities (starred from the POI card). */
export function SavedScreen() {
  const facilities = useAppStore((s) => s.facilities);
  const savedIds = useAppStore((s) => s.savedIds);
  const selectFacility = useAppStore((s) => s.selectFacility);
  const setTab = useAppStore((s) => s.setTab);
  const toggleSaved = useAppStore((s) => s.toggleSaved);

  const saved = facilities.filter((f) => savedIds.includes(f.id));

  return (
    <div className="grow overflow-y-auto bg-gray-50">
      <div className="px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-xl font-medium">Saved</h1>
        <p className="text-sm text-ink-soft">
          Your emergency plan — available offline.
        </p>
      </div>

      {saved.length === 0 ? (
        <div className="mx-4 flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <Icon name="star" size={26} />
          </span>
          <p className="font-medium">No saved places yet</p>
          <p className="text-sm text-ink-soft">
            Save your nearest shelter, hospital and water point so they are one
            tap away during an outage.
          </p>
          <button
            onClick={() => setTab("explore")}
            className="mt-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
          >
            Explore the map
          </button>
        </div>
      ) : (
        <ul className="space-y-2 px-4 pb-6">
          {saved.map((f) => {
            const meta = CATEGORY_META[f.category];
            const status = STATUS_META[f.status];
            return (
              <li key={f.id}>
                <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <button
                    className="flex min-w-0 grow items-center gap-3 text-left"
                    onClick={() => {
                      setTab("explore");
                      selectFacility(f.id);
                      mapRef.current?.flyTo({
                        center: [f.lng, f.lat],
                        zoom: 15,
                        padding: { bottom: 260 },
                      });
                    }}
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full"
                      style={{ background: `${meta.color}1a`, color: meta.color }}
                    >
                      <Icon name={meta.icon} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        <span style={{ color: status.color }}>{status.label}</span>
                        {" · verified "}
                        {timeAgo(f.lastUpdated)}
                      </span>
                    </span>
                  </button>
                  <button
                    aria-label={`Remove ${f.name} from saved`}
                    onClick={() => void toggleSaved(f.id)}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-warn"
                  >
                    <Icon name="star" size={20} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
