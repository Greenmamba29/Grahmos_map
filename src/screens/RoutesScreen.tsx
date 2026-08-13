import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { useAppStore } from "../store/appStore";
import { planRoute } from "../data/routePlanner";
import { styleFor } from "../map/styleFactory";
import { ensurePmtilesProtocol } from "../map/pmtilesProtocol";
import { isWebglSupported } from "../map/webgl";
import { env, CATEGORY_META } from "../config";
import { ElevationProfile } from "../components/route/ElevationProfile";
import { CautionBanner } from "../components/route/CautionBanner";
import { StepsList } from "../components/route/StepsList";
import { Icon } from "../components/ui/Icon";
import { formatDistance } from "../utils/format";
import type { TravelMode } from "../types";

const MODES: { id: TravelMode; label: string; icon: string }[] = [
  { id: "walk", label: "Walk", icon: "walk" },
  { id: "bike", label: "Bike", icon: "bike" },
  { id: "drive", label: "Drive", icon: "car" },
];

/** Pattern 5 — route screen: map preview, mode tabs, ETA, elevation, steps. */
export function RoutesScreen() {
  const facilities = useAppStore((s) => s.facilities);
  const routeTargetId = useAppStore((s) => s.routeTargetId);
  const startRoute = useAppStore((s) => s.startRoute);
  const userLocation = useAppStore((s) => s.userLocation);
  const [mode, setMode] = useState<TravelMode>("walk");

  const target = facilities.find((f) => f.id === routeTargetId) ?? null;
  const origin = userLocation ?? {
    lng: env.defaultCenter[0],
    lat: env.defaultCenter[1],
  };

  const plan = useMemo(
    () => (target ? planRoute(origin, target, mode) : null),
    [target, origin.lng, origin.lat, mode], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Destination picker (no target yet) ────────────────────────────────
  if (!target) {
    return (
      <div className="grow overflow-y-auto bg-gray-50">
        <div className="px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <h1 className="text-xl font-medium">Routes</h1>
          <p className="text-sm text-ink-soft">
            Choose a facility to get terrain-aware directions.
          </p>
        </div>
        <ul className="space-y-2 px-4 pb-6">
          {facilities.slice(0, 12).map((f) => {
            const meta = CATEGORY_META[f.category];
            return (
              <li key={f.id}>
                <button
                  onClick={() => startRoute(f.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm hover:shadow-md transition-shadow"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full"
                    style={{ background: `${meta.color}1a`, color: meta.color }}
                  >
                    <Icon name={meta.icon} size={18} />
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {f.address ?? meta.label}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={20} className="text-ink-soft" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex grow flex-col overflow-hidden">
      {/* Map preview with route line */}
      <div className="relative h-[30dvh] shrink-0">
        <RoutePreviewMap line={plan!.line} />
        <button
          aria-label="Back to destinations"
          onClick={() => startRoute(null)}
          className="absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-white shadow-[var(--shadow-float)]"
        >
          <Icon name="back" size={20} />
        </button>
      </div>

      <div className="grow overflow-y-auto">
        {/* Mode tabs */}
        <div className="flex border-b border-line bg-white">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={active}
                className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium ${
                  active ? "text-primary" : "text-ink-soft"
                }`}
              >
                <Icon name={m.icon} size={18} />
                {m.label}
                {active && (
                  <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-t-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* ETA + distance row */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-medium text-primary">
              {plan!.durationMin} min
            </span>
            <span className="text-sm text-ink-soft">
              {formatDistance(plan!.distanceM / 1000)} · ↑{plan!.ascentM} m ↓
              {plan!.descentM} m
            </span>
          </div>
          <p className="-mt-2 text-sm text-ink-soft">to {target.name}</p>

          {plan!.caution && <CautionBanner text={plan!.caution} />}

          {/* Elevation profile */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="mb-2 text-sm font-medium">Terrain profile</p>
            <ElevationProfile
              elevation={plan!.elevation}
              distanceM={plan!.distanceM}
            />
          </div>

          {/* Steps */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="mb-3 text-sm font-medium">Directions</p>
            <StepsList steps={plan!.steps} />
          </div>
        </div>
      </div>

      {/* Bottom Preview / Show map */}
      <div className="flex shrink-0 gap-3 border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="flex-1 rounded-full border border-line py-2.5 text-sm font-semibold text-primary">
          Preview
        </button>
        <button
          onClick={() => {
            useAppStore.getState().selectFacility(target.id);
            useAppStore.getState().setTab("explore");
          }}
          className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Show on map
        </button>
      </div>
    </div>
  );
}

/** Non-interactive mini map with the route polyline (Google-style casing). */
function RoutePreviewMap({ line }: { line: [number, number][] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapInst = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!ref.current || !isWebglSupported()) return;
    ensurePmtilesProtocol();
    const map = new maplibregl.Map({
      container: ref.current,
      style: styleFor("default"),
      interactive: false,
      attributionControl: false,
    });
    mapInst.current = map;
    return () => {
      mapInst.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;

    const apply = () => {
      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: line },
      };
      const existing = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource("route", { type: "geojson", data });
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#1765cc", "line-width": 9 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#4c8df6", "line-width": 6 },
        });
      }
      const lngs = line.map((c) => c[0]);
      const lats = line.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, duration: 0 },
      );
    };

    if (map.isStyleLoaded()) apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [line]);

  return (
    <div ref={ref} className="absolute inset-0 bg-gray-100">
      {!isWebglSupported() && (
        <div className="grid h-full place-items-center text-sm text-ink-soft">
          Route preview unavailable (WebGL blocked)
        </div>
      )}
    </div>
  );
}
