import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { ensurePmtilesProtocol } from "../../map/pmtilesProtocol";
import { styleFor } from "../../map/styleFactory";
import { mapRef } from "../../map/mapInstance";
import { env, CATEGORY_META, STATUS_META } from "../../config";
import { useAppStore } from "../../store/appStore";
import { useFilteredFacilities } from "../../hooks/useFacilities";
import { ICON_PATHS } from "../ui/Icon";
import type { Facility } from "../../types";

function markerElement(facility: Facility, selected: boolean): HTMLElement {
  const meta = CATEGORY_META[facility.category];
  const status = STATUS_META[facility.status];
  const el = document.createElement("button");
  el.className = "rm-marker";
  el.setAttribute("aria-label", facility.name);
  el.style.cssText = "background:none;border:none;padding:0;cursor:pointer;";
  const size = selected ? 40 : 30;
  el.innerHTML = `
    <div style="position:relative;width:${size}px;height:${size}px;transition:all .15s">
      <div style="width:100%;height:100%;border-radius:9999px 9999px 9999px 4px;transform:rotate(-45deg);
        background:${meta.color};box-shadow:0 2px 6px rgba(60,64,67,.4);
        display:flex;align-items:center;justify-content:center;border:2px solid #fff">
        <svg viewBox="0 0 24 24" width="${size * 0.52}" height="${size * 0.52}"
          fill="#fff" style="transform:rotate(45deg)">
          <path d="${ICON_PATHS[meta.icon]}"/>
        </svg>
      </div>
      <span style="position:absolute;top:-2px;right:-2px;width:11px;height:11px;border-radius:9999px;
        background:${status.color};border:2px solid #fff"></span>
    </div>`;
  return el;
}

const OVERLAY_SOURCE = "rm-offline-regions";
const TERRAIN_OVERLAY_SOURCE = "rm-terrain-overlay";

/** Full-bleed MapLibre map with facility markers and overlay layers. */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const facilities = useFilteredFacilities();
  const mapType = useAppStore((s) => s.layers.mapType);
  const hillshade = useAppStore((s) => s.layers.hillshade);
  const contours = useAppStore((s) => s.layers.contours);
  const showOfflineRegions = useAppStore((s) => s.layers.showOfflineRegions);
  const regions = useAppStore((s) => s.regions);
  const selectedFacilityId = useAppStore((s) => s.selectedFacilityId);
  const selectFacility = useAppStore((s) => s.selectFacility);
  const userLocation = useAppStore((s) => s.userLocation);

  // Init once.
  useEffect(() => {
    if (!containerRef.current) return;
    ensurePmtilesProtocol();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleFor("default"),
      center: env.defaultCenter,
      zoom: env.defaultZoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on("click", () => useAppStore.getState().selectFacility(null));
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Map type switching.
  useEffect(() => {
    mapRef.current?.setStyle(styleFor(mapType));
  }, [mapType]);

  // Facility markers (DOM markers survive style changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const wanted = new Set(facilities.map((f) => f.id));

    for (const [id, marker] of markers) {
      if (!wanted.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    for (const f of facilities) {
      markers.get(f.id)?.remove();
      markers.delete(f.id);
      const el = markerElement(f, f.id === selectedFacilityId);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        selectFacility(f.id);
        mapRef.current?.easeTo({
          center: [f.lng, f.lat],
          padding: { bottom: 260 },
          duration: 450,
        });
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([f.lng, f.lat])
        .addTo(map);
      markers.set(f.id, marker);
    }
  }, [facilities, selectedFacilityId, selectFacility]);

  // User location dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;
    const el = document.createElement("div");
    el.innerHTML = `
      <div style="position:relative;width:22px;height:22px">
        <span style="position:absolute;inset:-8px;border-radius:9999px;background:rgba(26,115,232,.18)"></span>
        <span style="position:absolute;inset:0;border-radius:9999px;background:#1a73e8;border:3px solid #fff;
          box-shadow:0 1px 4px rgba(60,64,67,.5)"></span>
      </div>`;
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);
  }, [userLocation]);

  // Offline region overlay + terrain overlay (re-applied after style changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // Downloaded-region bounding boxes.
      if (map.getLayer("rm-regions-line")) map.removeLayer("rm-regions-line");
      if (map.getLayer("rm-regions-fill")) map.removeLayer("rm-regions-fill");
      if (map.getSource(OVERLAY_SOURCE)) map.removeSource(OVERLAY_SOURCE);
      if (showOfflineRegions && regions.length > 0) {
        map.addSource(OVERLAY_SOURCE, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: regions.map((r) => ({
              type: "Feature" as const,
              properties: { name: r.name },
              geometry: {
                type: "Polygon" as const,
                coordinates: [
                  [
                    [r.bbox.minLng, r.bbox.minLat],
                    [r.bbox.maxLng, r.bbox.minLat],
                    [r.bbox.maxLng, r.bbox.maxLat],
                    [r.bbox.minLng, r.bbox.maxLat],
                    [r.bbox.minLng, r.bbox.minLat],
                  ],
                ],
              },
            })),
          },
        });
        map.addLayer({
          id: "rm-regions-fill",
          type: "fill",
          source: OVERLAY_SOURCE,
          paint: { "fill-color": "#1a73e8", "fill-opacity": 0.06 },
        });
        map.addLayer({
          id: "rm-regions-line",
          type: "line",
          source: OVERLAY_SOURCE,
          paint: {
            "line-color": "#1a73e8",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }

      // Lightweight terrain overlay for the hillshade/contour toggles when no
      // offline DEM is configured (OpenTopoMap raster at reduced opacity).
      if (map.getLayer("rm-terrain-overlay")) map.removeLayer("rm-terrain-overlay");
      if (map.getSource(TERRAIN_OVERLAY_SOURCE)) map.removeSource(TERRAIN_OVERLAY_SOURCE);
      if ((hillshade || contours) && mapType === "default" && !env.terrainPmtilesUrl) {
        map.addSource(TERRAIN_OVERLAY_SOURCE, {
          type: "raster",
          tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 17,
        });
        map.addLayer({
          id: "rm-terrain-overlay",
          type: "raster",
          source: TERRAIN_OVERLAY_SOURCE,
          paint: { "raster-opacity": contours ? 0.5 : 0.3 },
        });
      }
    };

    if (map.isStyleLoaded()) apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [showOfflineRegions, regions, hillshade, contours, mapType]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
