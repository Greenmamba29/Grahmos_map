import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";

let registered = false;

/**
 * Registers the `pmtiles://` protocol with MapLibre once per app lifetime.
 * After this, style sources can reference `pmtiles:///tiles/streets.pmtiles`
 * and MapLibre will read the archive directly via HTTP range requests —
 * no tile server required. See INSTALLATION_GUIDE.md §4 for how the
 * archives themselves are generated from OpenStreetMap extracts.
 */
export function registerPmtilesProtocol() {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  registered = true;
}
