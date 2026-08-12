import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'

let protocol: Protocol | undefined
let registrations = 0

export function registerPmtilesProtocol() {
  registrations += 1

  if (!protocol) {
    protocol = new Protocol({ metadata: true })
    maplibregl.addProtocol('pmtiles', protocol.tile)
  }

  return () => {
    registrations = Math.max(0, registrations - 1)
    if (registrations === 0 && protocol) {
      maplibregl.removeProtocol('pmtiles')
      protocol = undefined
    }
  }
}
