import type { StyleSpecification } from "maplibre-gl";
import { env } from "../config";
import type { MapType } from "../types";

const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Minimal OpenMapTiles-schema style rendered from a local PMTiles archive.
 * Used when VITE_BASEMAP_PMTILES_URL is configured (true offline mode).
 */
function pmtilesVectorStyle(url: string): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      basemap: { type: "vector", url: `pmtiles://${url}` },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#f8f9fa" } },
      {
        id: "landuse-green",
        type: "fill",
        source: "basemap",
        "source-layer": "landcover",
        paint: { "fill-color": "#ceead6", "fill-opacity": 0.7 },
      },
      {
        id: "water",
        type: "fill",
        source: "basemap",
        "source-layer": "water",
        paint: { "fill-color": "#aecbfa" },
      },
      {
        id: "buildings",
        type: "fill",
        source: "basemap",
        "source-layer": "building",
        minzoom: 13,
        paint: { "fill-color": "#e8eaed", "fill-outline-color": "#dadce0" },
      },
      {
        id: "roads-casing",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        paint: { "line-color": "#dadce0", "line-width": 4 },
      },
      {
        id: "roads",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        paint: { "line-color": "#ffffff", "line-width": 2.5 },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: "basemap",
        "source-layer": "place",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#5f6368",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      },
    ],
  };
  return style;
}

function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxzoom: 19,
      },
    },
    layers: [{ id: "esri", type: "raster", source: "esri" }],
  };
}

function terrainStyle(): StyleSpecification {
  // With a terrain PMTiles archive we could render hillshade offline; the
  // online fallback uses OpenTopoMap's contour + shading raster.
  if (env.terrainPmtilesUrl) {
    const base = env.basemapPmtilesUrl
      ? pmtilesVectorStyle(env.basemapPmtilesUrl)
      : pmtilesVectorStyle(""); // unreachable in practice
    base.sources.dem = {
      type: "raster-dem",
      url: `pmtiles://${env.terrainPmtilesUrl}`,
      encoding: "terrarium",
      tileSize: 256,
    };
    base.layers.splice(1, 0, {
      id: "hillshade",
      type: "hillshade",
      source: "dem",
      paint: { "hillshade-exaggeration": 0.35 },
    });
    return base;
  }
  return {
    version: 8,
    sources: {
      topo: {
        type: "raster",
        tiles: [
          "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)",
        maxzoom: 17,
      },
    },
    layers: [{ id: "topo", type: "raster", source: "topo" }],
  };
}

/** Resolve the MapLibre style for a given map type. */
export function styleFor(mapType: MapType): string | StyleSpecification {
  switch (mapType) {
    case "satellite":
      return satelliteStyle();
    case "terrain":
      return terrainStyle();
    default:
      return env.basemapPmtilesUrl
        ? pmtilesVectorStyle(env.basemapPmtilesUrl)
        : OPENFREEMAP_LIBERTY;
  }
}
