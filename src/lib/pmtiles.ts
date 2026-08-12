import { Protocol } from 'pmtiles';
import maplibregl from 'maplibre-gl';

let protocolAdded = false;

export function registerPmtilesProtocol(): void {
  if (protocolAdded) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolAdded = true;
}

export function getPmtilesUrl(): string {
  const url = import.meta.env.VITE_PMTILES_URL ?? '/tiles/region.pmtiles';
  return `pmtiles://${window.location.origin}${url}`;
}
