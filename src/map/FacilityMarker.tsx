import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import type { Feature, Point } from "geojson";
import { useMap } from "./MapProvider";
import { CATEGORY_META, type Facility } from "@/data/types";

interface FacilityProps {
  facility: Facility;
}

type ClusterProps = FacilityProps | { cluster: true; point_count: number };

function createPinElement(facility: Facility): HTMLDivElement {
  const meta = CATEGORY_META[facility.category];
  const el = document.createElement("div");
  el.className = "facility-pin";
  el.style.setProperty("--pin-color", meta.color);
  el.innerHTML = `
    <div class="facility-pin__dot"></div>
  `;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", facility.name);
  return el;
}

function createClusterElement(count: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "facility-cluster";
  el.textContent = count > 99 ? "99+" : String(count);
  return el;
}

interface FacilityMarkersLayerProps {
  facilities: Facility[];
  onSelect: (id: string) => void;
}

export function FacilityMarkersLayer({
  facilities,
  onSelect,
}: FacilityMarkersLayerProps) {
  const { map } = useMap();
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const index = useMemo(() => {
    const cluster = new Supercluster<ClusterProps>({
      radius: 50,
      maxZoom: 16,
    });
    const points: Feature<Point, ClusterProps>[] = facilities.map((f) => ({
      type: "Feature",
      properties: { facility: f },
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
    }));
    cluster.load(points);
    return cluster;
  }, [facilities]);

  useEffect(() => {
    if (!map) return;

    function render() {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = map!.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const zoom = Math.round(map!.getZoom());
      const clusters = index.getClusters(bbox, zoom);

      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as
          | { cluster: true; cluster_id: number; point_count: number }
          | { facility: Facility };

        if ("cluster" in props && props.cluster) {
          const el = createClusterElement(props.point_count);
          el.addEventListener("click", () => {
            const expansionZoom = Math.min(
              index.getClusterExpansionZoom(props.cluster_id),
              20,
            );
            map!.easeTo({ center: [lng, lat], zoom: expansionZoom });
          });
          const marker = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map!);
          markersRef.current.push(marker);
        } else if ("facility" in props) {
          const facility = props.facility;
          const el = createPinElement(facility);
          el.addEventListener("click", () => onSelect(facility.id));
          const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([lng, lat])
            .addTo(map!);
          markersRef.current.push(marker);
        }
      }
    }

    render();
    map.on("moveend", render);
    map.on("zoomend", render);
    return () => {
      map.off("moveend", render);
      map.off("zoomend", render);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, index, onSelect]);

  return null;
}
