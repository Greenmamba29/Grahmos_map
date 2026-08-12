import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Download } from "lucide-react";
import { registerPmtilesProtocol } from "@/map/pmtilesProtocol";
import { resolveMapStyle } from "@/map/mapStyles";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { CATEGORY_META, type FacilityCategory } from "@/data/types";
import { estimateRegionSizeMb, createQueuedRegion } from "./downloadManager";
import { useOfflineStore } from "@/store/useOfflineStore";

const DEFAULT_CENTER: [number, number] = [
  Number(import.meta.env.VITE_MAP_DEFAULT_CENTER_LNG ?? -122.4194),
  Number(import.meta.env.VITE_MAP_DEFAULT_CENTER_LAT ?? 37.7749),
];

const PADDING_PX = 36;

export function RegionSelector() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bbox, setBbox] = useState<[number, number, number, number]>([
    DEFAULT_CENTER[0] - 0.08,
    DEFAULT_CENTER[1] - 0.08,
    DEFAULT_CENTER[0] + 0.08,
    DEFAULT_CENTER[1] + 0.08,
  ]);
  const [maxZoom, setMaxZoom] = useState(14);
  const [categories, setCategories] = useState<FacilityCategory[]>([
    "hospital",
    "shelter",
    "water",
    "power",
    "comms",
    "school",
  ]);
  const [downloading, setDownloading] = useState(false);
  const addRegion = useOfflineStore((s) => s.addRegion);
  const updateRegion = useOfflineStore((s) => s.updateRegion);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    registerPmtilesProtocol();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle("streets", false),
      center: DEFAULT_CENTER,
      zoom: 10.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    function updateBboxFromViewport() {
      const rect = containerRef.current!.getBoundingClientRect();
      const nw = map.unproject([PADDING_PX, PADDING_PX]);
      const se = map.unproject([rect.width - PADDING_PX, rect.height - PADDING_PX]);
      setBbox([nw.lng, se.lat, se.lng, nw.lat]);
    }

    map.on("load", updateBboxFromViewport);
    map.on("moveend", updateBboxFromViewport);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const sizeMb = estimateRegionSizeMb(bbox, 8, maxZoom, categories);

  function toggleCategory(category: FacilityCategory) {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }

  function handleDownload() {
    const region = createQueuedRegion(
      `Custom region (${sizeMb} MB)`,
      bbox,
      8,
      maxZoom,
      categories,
    );
    addRegion(region);
    setDownloading(true);
    updateRegion(region.id, { status: "downloading" });

    setTimeout(() => {
      updateRegion(region.id, {
        status: "ready",
        downloadedAt: new Date().toISOString(),
      });
      setDownloading(false);
    }, 2200);
  }

  return (
    <div className="space-y-4">
      <div className="relative h-56 overflow-hidden rounded-2xl">
        <div ref={containerRef} className="absolute inset-0" />
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-dashed border-accent bg-accent/10"
          style={{ inset: `${PADDING_PX}px` }}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink shadow-floating">
          Pan/zoom the map — the dashed box is your download area
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Facility layers to include
        </h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_META) as FacilityCategory[]).map((category) => {
            const meta = CATEGORY_META[category];
            return (
              <Chip
                key={category}
                label={meta.label}
                active={categories.includes(category)}
                color={meta.color}
                onClick={() => toggleCategory(category)}
              />
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-faint">
          <span>Detail level</span>
          <span className="text-ink-muted">max zoom {maxZoom}</span>
        </div>
        <input
          type="range"
          min={10}
          max={16}
          value={maxZoom}
          onChange={(e) => setMaxZoom(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-accent-soft px-4 py-3">
        <span className="text-sm font-medium text-accent">Estimated size</span>
        <span className="text-lg font-semibold text-accent">{sizeMb} MB</span>
      </div>

      <Button fullWidth icon={<Download size={18} />} onClick={handleDownload} disabled={downloading}>
        {downloading ? "Downloading region…" : "Download region for offline use"}
      </Button>
    </div>
  );
}
