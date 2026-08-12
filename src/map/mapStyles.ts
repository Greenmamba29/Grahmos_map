import type { StyleSpecification } from "maplibre-gl";
import type { BaseMapStyle } from "@/store/useAppStore";

const TILES_BASE_URL = import.meta.env.VITE_TILES_BASE_URL ?? "/tiles";

/**
 * Fallback raster basemaps used whenever the regional PMTiles archives
 * (built via `scripts/pmtiles/`, see INSTALLATION_GUIDE.md §4) have not been
 * generated/copied into `public/tiles` yet — e.g. fresh clone, CI preview,
 * or before running the offline-tile pipeline. Once `streets.pmtiles`
 * exists it takes priority (see `resolveMapStyle`) and the app renders the
 * fully offline-capable vector style instead.
 */
const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "osm-raster-layer", type: "raster", source: "osm-raster" },
  ],
};

const SATELLITE_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "satellite-raster": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "satellite-raster-layer", type: "raster", source: "satellite-raster" },
  ],
};

const TERRAIN_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "terrain-raster": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri — World Physical Map",
      maxzoom: 8,
    },
    "osm-raster": OSM_RASTER_STYLE.sources["osm-raster"],
  },
  layers: [
    { id: "terrain-raster-layer", type: "raster", source: "terrain-raster" },
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster",
      paint: { "raster-opacity": 0.35 },
    },
  ],
};

/**
 * Fully offline vector style: reads directly from a local `.pmtiles`
 * archive via the registered `pmtiles://` protocol (see
 * `pmtilesProtocol.ts`). This is the production style once
 * `scripts/pmtiles/03_generate_vector_pmtiles.sh` has produced
 * `streets.pmtiles` for the target region.
 */
export function buildPmtilesVectorStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      "resilience-vector": {
        type: "vector",
        url: `pmtiles://${TILES_BASE_URL}/streets.pmtiles`,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#F5F5F3" },
      },
      {
        id: "water",
        type: "fill",
        source: "resilience-vector",
        "source-layer": "water",
        paint: { "fill-color": "#AFDBF5" },
      },
      {
        id: "landuse",
        type: "fill",
        source: "resilience-vector",
        "source-layer": "landuse",
        paint: { "fill-color": "#E8EAD9", "fill-opacity": 0.6 },
      },
      {
        id: "roads",
        type: "line",
        source: "resilience-vector",
        "source-layer": "transportation",
        paint: { "line-color": "#FFFFFF", "line-width": 1.4 },
      },
      {
        id: "buildings",
        type: "fill",
        source: "resilience-vector",
        "source-layer": "building",
        paint: { "fill-color": "#E3E2DE" },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: "resilience-vector",
        "source-layer": "place",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#333333" },
      },
    ],
  };
}

/**
 * Hillshade + contour raster-dem overlay from `terrain.pmtiles`, added on
 * top of any base style when the terrain toggle is active in the Layers
 * Drawer.
 */
export function buildTerrainOverlaySources() {
  return {
    sourceId: "resilience-terrain-dem",
    source: {
      type: "raster-dem" as const,
      url: `pmtiles://${TILES_BASE_URL}/terrain.pmtiles`,
      tileSize: 256,
    },
  };
}

export function resolveMapStyle(
  baseMapStyle: BaseMapStyle,
  pmtilesAvailable: boolean,
): StyleSpecification {
  if (baseMapStyle === "streets" && pmtilesAvailable) {
    return buildPmtilesVectorStyle();
  }
  switch (baseMapStyle) {
    case "satellite":
      return SATELLITE_RASTER_STYLE;
    case "terrain":
      return TERRAIN_RASTER_STYLE;
    default:
      return OSM_RASTER_STYLE;
  }
}

export async function checkPmtilesAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${TILES_BASE_URL}/streets.pmtiles`, {
      method: "HEAD",
    });
    if (!res.ok) return false;
    // Dev servers (and some static hosts) fall back to index.html for
    // unmatched paths instead of a real 404, so a bare `res.ok` check isn't
    // reliable — require a non-HTML content type as a sanity check that we
    // actually hit the generated .pmtiles archive rather than the SPA shell.
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) return false;
    return true;
  } catch {
    return false;
  }
}

export { TILES_BASE_URL };
