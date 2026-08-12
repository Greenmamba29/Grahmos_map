import { useAppStore } from "../../store/appStore";
import { CATEGORIES } from "../../config";
import { BottomSheet } from "../ui/BottomSheet";
import { Switch } from "../ui/Switch";
import { Icon } from "../ui/Icon";
import type { MapType } from "../../types";

const MAP_TYPES: { id: MapType; label: string; preview: string }[] = [
  {
    id: "default",
    label: "Default",
    preview:
      "linear-gradient(135deg,#f8f9fa 0%,#e8f0fe 45%,#ceead6 100%)",
  },
  {
    id: "terrain",
    label: "Terrain",
    preview:
      "linear-gradient(135deg,#e6f4ea 0%,#ceead6 40%,#a8dab5 70%,#81c995 100%)",
  },
  {
    id: "satellite",
    label: "Satellite",
    preview:
      "linear-gradient(135deg,#1e3a2f 0%,#2d4a3e 40%,#3c5a4d 70%,#213547 100%)",
  },
];

/** Pattern 2 — layers drawer: map type, detail toggles, offline overlay. */
export function LayersDrawer() {
  const open = useAppStore((s) => s.layersDrawerOpen);
  const setOpen = useAppStore((s) => s.setLayersDrawerOpen);
  const layers = useAppStore((s) => s.layers);
  const setMapType = useAppStore((s) => s.setMapType);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const toggleCategoryVisibility = useAppStore((s) => s.toggleCategoryVisibility);

  return (
    <BottomSheet open={open} onClose={() => setOpen(false)} title="Map details">
      <div className="px-5 pb-8">
        {/* Map type */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Map type
        </p>
        <div className="mb-6 flex gap-4">
          {MAP_TYPES.map((t) => {
            const active = layers.mapType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMapType(t.id)}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={`h-14 w-16 rounded-xl transition-shadow ${
                    active ? "ring-[3px] ring-primary" : "ring-1 ring-line"
                  }`}
                  style={{ background: t.preview }}
                />
                <span
                  className={`text-xs font-medium ${
                    active ? "text-primary" : "text-ink-soft"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Facility categories */}
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Facility layers
        </p>
        <div className="mb-4 divide-y divide-line rounded-2xl border border-line">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="grid size-8 place-items-center rounded-full"
                style={{ background: `${c.color}1a`, color: c.color }}
              >
                <Icon name={c.icon} size={16} />
              </span>
              <span className="grow text-sm font-medium">{c.label}</span>
              <Switch
                checked={layers.categoryVisibility[c.id]}
                onChange={() => toggleCategoryVisibility(c.id)}
                label={`Show ${c.label}`}
              />
            </div>
          ))}
        </div>

        {/* Terrain + offline details */}
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Details
        </p>
        <div className="divide-y divide-line rounded-2xl border border-line">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-gray-100 text-ink-soft">
              <Icon name="map" size={16} />
            </span>
            <div className="grow">
              <p className="text-sm font-medium">Hillshade</p>
              <p className="text-xs text-ink-soft">Terrain relief shading</p>
            </div>
            <Switch
              checked={layers.hillshade}
              onChange={() => toggleLayer("hillshade")}
              label="Hillshade"
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-gray-100 text-ink-soft">
              <Icon name="route" size={16} />
            </span>
            <div className="grow">
              <p className="text-sm font-medium">Contour lines</p>
              <p className="text-xs text-ink-soft">Elevation contours</p>
            </div>
            <Switch
              checked={layers.contours}
              onChange={() => toggleLayer("contours")}
              label="Contour lines"
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary">
              <Icon name="download" size={16} />
            </span>
            <div className="grow">
              <p className="text-sm font-medium">Downloaded regions</p>
              <p className="text-xs text-ink-soft">
                Outline offline map coverage
              </p>
            </div>
            <Switch
              checked={layers.showOfflineRegions}
              onChange={() => toggleLayer("showOfflineRegions")}
              label="Downloaded regions"
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
