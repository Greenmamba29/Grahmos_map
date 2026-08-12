import type * as maplibregl from "maplibre-gl";

/** Module-level handle so floating controls (locate, chips) can drive the map. */
export const mapRef: { current: maplibregl.Map | null } = { current: null };
