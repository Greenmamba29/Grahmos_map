import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import type { Feature, LineString } from "geojson";
import { ChevronLeft } from "lucide-react";
import { registerPmtilesProtocol } from "@/map/pmtilesProtocol";
import { resolveMapStyle } from "@/map/mapStyles";
import { useFacilities } from "@/data/useFacilities";
import { CATEGORY_META } from "@/data/types";
import { Button } from "@/ui/Button";
import { ModeTabs } from "./ModeTabs";
import { EtaDistanceRow } from "./EtaDistanceRow";
import { ElevationProfile } from "./ElevationProfile";
import { CautionBanner } from "./CautionBanner";
import { TurnByTurnList } from "./TurnByTurnList";
import { estimateEtaMinutes, haversineDistanceM, synthesizeRoute, type TravelMode } from "./mockRouting";

const DEFAULT_CENTER: [number, number] = [
  Number(import.meta.env.VITE_MAP_DEFAULT_CENTER_LNG ?? -122.4194),
  Number(import.meta.env.VITE_MAP_DEFAULT_CENTER_LAT ?? 37.7749),
];

export function RouteScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const facilityId = params.get("to");
  const { facilities } = useFacilities();
  const facility = useMemo(
    () => facilities.find((f) => f.id === facilityId) ?? facilities[0],
    [facilities, facilityId],
  );

  const [mode, setMode] = useState<TravelMode>("drive");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const route = useMemo(() => {
    if (!facility) return null;
    return synthesizeRoute(DEFAULT_CENTER, facility);
  }, [facility]);

  const distanceM = useMemo(
    () => (facility ? haversineDistanceM(DEFAULT_CENTER, [facility.lng, facility.lat]) : 0),
    [facility],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !facility) return;
    registerPmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle("streets", false),
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
      interactive: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      const lineGeoJson: Feature<LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [DEFAULT_CENTER, [facility.lng, facility.lat]],
        },
      };
      map.addSource("route-line", { type: "geojson", data: lineGeoJson });
      map.addLayer({
        id: "route-line-layer",
        type: "line",
        source: "route-line",
        paint: { "line-color": "#1A73E8", "line-width": 4, "line-dasharray": [0.001, 0] },
      });

      new maplibregl.Marker({ color: "#1A73E8" }).setLngLat(DEFAULT_CENTER).addTo(map);
      new maplibregl.Marker({ color: CATEGORY_META[facility.category].color })
        .setLngLat([facility.lng, facility.lat])
        .addTo(map);

      const bounds = new maplibregl.LngLatBounds(DEFAULT_CENTER, DEFAULT_CENTER);
      bounds.extend([facility.lng, facility.lat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [facility]);

  if (!facility || !route) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-ink-muted">No destination selected.</p>
        <Button onClick={() => navigate("/")}>Back to Explore</Button>
      </div>
    );
  }

  const etaMinutes = estimateEtaMinutes(distanceM, mode);

  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[38%] shrink-0">
        <div ref={containerRef} className="absolute inset-0" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-floating"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium" style={{ color: CATEGORY_META[facility.category].color }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_META[facility.category].color }} />
          {CATEGORY_META[facility.category].label}
        </div>
        <h1 className="mb-3 text-lg font-semibold text-ink">Route to {facility.name}</h1>

        <div className="mb-4">
          <ModeTabs value={mode} onChange={setMode} />
        </div>

        <div className="mb-4">
          <EtaDistanceRow etaMinutes={etaMinutes} distanceM={distanceM} />
        </div>

        {route.hazard && (
          <div className="mb-4">
            <CautionBanner
              severity="warning"
              message="Route may be blocked or unverified — conditions may vary"
              reportedBy="field responder, 2h ago"
            />
          </div>
        )}

        <div className="mb-4 rounded-2xl bg-white p-3 shadow-floating">
          <ElevationProfile data={route.elevation} />
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-floating">
          <TurnByTurnList steps={route.steps} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-black/5 bg-white p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <Button variant="secondary" fullWidth onClick={() => navigate(-1)}>
          Preview
        </Button>
        <Button variant="primary" fullWidth onClick={() => navigate(-1)}>
          Start Navigation
        </Button>
      </div>
    </div>
  );
}
