import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { ensurePmtilesProtocol } from "../../map/pmtilesProtocol";
import { isWebglSupported } from "../../map/webgl";
import { styleFor } from "../../map/styleFactory";
import { env } from "../../config";
import { useAppStore } from "../../store/appStore";
import { facilitiesInBBox } from "../../data/facilitiesRepo";
import { snapshotFacilities } from "../../data/idb";
import { Icon } from "../ui/Icon";
import { formatMb } from "../../utils/format";
import type { BBox } from "../../types";

function bboxAreaKm2(b: BBox): number {
  const midLat = ((b.minLat + b.maxLat) / 2) * (Math.PI / 180);
  const wKm = (b.maxLng - b.minLng) * 111.32 * Math.cos(midLat);
  const hKm = (b.maxLat - b.minLat) * 110.57;
  return Math.abs(wKm * hKm);
}

/** Rough tiles-through-z14 size estimate for the live preview. */
function estimateSizeMb(b: BBox, facilityCount: number): number {
  const area = bboxAreaKm2(b);
  return Math.max(4, area * 0.14 + facilityCount * 0.002 + 6);
}

interface Props {
  onClose: () => void;
}

/**
 * Pattern 6 — "Download region" flow: pan/zoom the map under a fixed
 * selection frame; the size estimate updates live as the box changes.
 */
export function RegionSelectModal({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapInst = useRef<maplibregl.Map | null>(null);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [name, setName] = useState("My region");
  const facilities = useAppStore((s) => s.facilities);
  const addRegion = useAppStore((s) => s.addRegion);
  const updateRegion = useAppStore((s) => s.updateRegion);

  useEffect(() => {
    if (!ref.current) return;
    if (!isWebglSupported()) {
      // No map — offer a sensible default box around the home view so the
      // download flow still works on WebGL-less browsers.
      setBbox({
        minLng: env.defaultCenter[0] - 0.08,
        minLat: env.defaultCenter[1] - 0.06,
        maxLng: env.defaultCenter[0] + 0.08,
        maxLat: env.defaultCenter[1] + 0.06,
      });
      return;
    }
    ensurePmtilesProtocol();
    const map = new maplibregl.Map({
      container: ref.current,
      style: styleFor("default"),
      center: env.defaultCenter,
      zoom: Math.max(env.defaultZoom - 2, 8),
      attributionControl: false,
    });
    mapInst.current = map;

    const computeBbox = () => {
      // Selection frame = viewport inset by 12% horizontally / 20% vertically.
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const sw = map.unproject([w * 0.12, h * 0.8]);
      const ne = map.unproject([w * 0.88, h * 0.2]);
      setBbox({
        minLng: sw.lng,
        minLat: sw.lat,
        maxLng: ne.lng,
        maxLat: ne.lat,
      });
    };
    map.on("move", computeBbox);
    map.on("load", computeBbox);
    return () => {
      mapInst.current = null;
      map.remove();
    };
  }, []);

  const inBox = bbox ? facilitiesInBBox(facilities, bbox) : [];
  const sizeMb = bbox ? estimateSizeMb(bbox, inBox.length) : 0;

  const download = () => {
    if (!bbox) return;
    const id = crypto.randomUUID();
    addRegion({
      id,
      name,
      bbox,
      sizeMb: Math.round(sizeMb * 10) / 10,
      facilityCount: inBox.length,
      downloadedAt: new Date().toISOString(),
      state: "downloading",
      progress: 0,
    });
    // Snapshot facility data immediately; simulate tile-pyramid warm-up.
    void snapshotFacilities(inBox);
    let p = 0;
    const timer = setInterval(() => {
      p += 0.12 + Math.random() * 0.1;
      if (p >= 1) {
        clearInterval(timer);
        updateRegion(id, { state: "downloaded", progress: undefined });
      } else {
        updateRegion(id, { progress: p });
      }
    }, 350);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          aria-label="Cancel"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-gray-100"
        >
          <Icon name="close" size={20} />
        </button>
        <div className="min-w-0 grow">
          <p className="text-sm font-medium">Download this area?</p>
          <p className="text-xs text-ink-soft">
            Pan and zoom to frame the region
          </p>
        </div>
      </div>

      {/* Map + fixed selection frame */}
      <div className="relative grow">
        <div ref={ref} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-[12%] top-[20%] bottom-[20%] rounded-xl border-[3px] border-primary shadow-[0_0_0_2000px_rgba(32,33,36,0.28)]" />
        {/* Live estimate chip */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">
            ≈ {formatMb(sizeMb)} · tiles + {inBox.length} facilities
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Region name"
          className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-primary"
          placeholder="Region name"
        />
        <button
          onClick={download}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="download" size={18} />
          Download ({formatMb(sizeMb)})
        </button>
      </div>
    </div>
  );
}
