import type { Beacon } from '../indoor/types'
import type { BeaconSighting } from './engine'
import { beaconIndex, resolveAdvertisement, type BeaconScanner } from './scanners'

/** The slice of @capacitor-community/bluetooth-le this scanner uses (injected so tests can fake it). */
export interface NativeBle {
  initialize(options?: { androidNeverForLocation?: boolean }): Promise<void>
  requestLEScan(
    options: { allowDuplicates?: boolean; services?: string[] },
    callback: (result: {
      rssi?: number
      manufacturerData?: Record<string, DataView>
      serviceData?: Record<string, DataView>
    }) => void,
  ): Promise<void>
  stopLEScan(): Promise<void>
}

/** Plugin keys are strings: company ids as decimal ("76" = Apple), service data by UUID. */
function companyMap(data?: Record<string, DataView>) {
  const out = new Map<number, DataView>()
  for (const [key, value] of Object.entries(data ?? {})) {
    const id = Number(key)
    if (Number.isInteger(id)) out.set(id, value)
  }
  return out
}

/**
 * Beacon scanning in the Capacitor shell (Android and iOS) via @capacitor-community/bluetooth-le.
 * Feeds the same PositioningEngine as the browser scanner.
 *
 * iOS note: CoreBluetooth hides iBeacon frames from apps, so on iPhone beacons must also broadcast
 * Eddystone-UID (most beacons can do both); the demo venue's beacons carry both identities.
 */
export class NativeBeaconScanner implements BeaconScanner {
  readonly label = 'Bluetooth beacons (native)'
  private running = false

  constructor(
    private readonly beacons: Beacon[],
    private readonly ble: NativeBle,
  ) {}

  async start(onSighting: (s: BeaconSighting) => void) {
    // Location-derived scanning: Android must not assert neverForLocation, or beacons are filtered out.
    await this.ble.initialize({ androidNeverForLocation: false })
    const index = beaconIndex(this.beacons)
    await this.ble.requestLEScan({ allowDuplicates: true }, (result) => {
      const sighting = resolveAdvertisement(index, {
        rssi: result.rssi,
        manufacturerData: companyMap(result.manufacturerData),
        serviceData: new Map(Object.entries(result.serviceData ?? {})),
      })
      if (sighting) onSighting(sighting)
    })
    this.running = true
  }

  stop() {
    if (!this.running) return
    this.running = false
    void this.ble.stopLEScan().catch(() => {})
  }
}
