import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { registerPmtilesProtocol } from "./pmtilesProtocol";
import {
  buildTerrainOverlaySources,
  checkPmtilesAvailable,
  resolveMapStyle,
} from "./mapStyles";
import { useMap } from "./MapProvider";
import { useAppStore } from "@/store/useAppStore";
import { FacilityMarkersLayer } from "./FacilityMarker";
import type { Facility } from "@/data/types";

const DEFAULT_CENTER: [number, number] = [
  Number(import.meta.env.VITE_MAP_DEFAULT_CENTER_LNG ?? -122.4194),
  Number(import.meta.env.VITE_MAP_DEFAULT_CENTER_LAT ?? 37.7749),
];
const DEFAULT_ZOOM = Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM ?? 11);

interface MapCanvasProps {
  facilities: Facility[];
  onSelectFacility: (id: string) => void;
}

export function MapCanvas({ facilities, onSelectFacility }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { setMap, map } = useMap();
  const [pmtilesAvailable, setPmtilesAvailable] = useState(false);
  const baseMapStyle = useAppStore((s) => s.baseMapStyle);
  const showTerrainOverlay = useAppStore((s) => s.showTerrainOverlay);

  useEffect(() => {
    registerPmtilesProtocol();
    checkPmtilesAvailable().then(setPmtilesAvailable);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle(baseMapStyle, pmtilesAvailable),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });

    mapRef.current = instance;
    setMap(instance);

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(resolveMapStyle(baseMapStyle, pmtilesAvailable));
  }, [baseMapStyle, pmtilesAvailable]);

  useEffect(() => {
    if (!map) return;

    function applyTerrain() {
      if (!showTerrainOverlay) {
        if (map!.getLayer("terrain-hillshade")) map!.removeLayer("terrain-hillshade");
        if (map!.getSource("resilience-terrain-dem")) map!.removeSource("resilience-terrain-dem");
        return;
      }
      if (!pmtilesAvailable) return; // no local terrain.pmtiles to source from yet
      if (map!.getSource("resilience-terrain-dem")) return;
      const { sourceId, source } = buildTerrainOverlaySources();
      map!.addSource(sourceId, source);
      map!.addLayer({
        id: "terrain-hillshade",
        type: "hillshade",
        source: sourceId,
        paint: { "hillshade-exaggeration": 0.6 },
      });
    }

    if (map.isStyleLoaded()) applyTerrain();
    map.on("styledata", applyTerrain);
    return () => {
      map.off("styledata", applyTerrain);
    };
  }, [map, showTerrainOverlay, pmtilesAvailable]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {map && (
        <FacilityMarkersLayer facilities={facilities} onSelect={onSelectFacility} />
      )}
    </div>
  );
}
