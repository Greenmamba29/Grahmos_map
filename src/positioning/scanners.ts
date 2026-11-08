import { distance } from '../indoor/geometry'
import type { Beacon, Point } from '../indoor/types'
import { distanceToRssi, type BeaconSighting } from './engine'

export interface BeaconScanner {
  readonly label: string
  start(onSighting: (s: BeaconSighting) => void): Promise<void>
  stop(): void
}

const APPLE_COMPANY_ID = 0x004c
const EDDYSTONE_SERVICE = 0xfeaa

function hex(view: DataView, offset: number, length: number) {
  let out = ''
  for (let i = 0; i < length; i++) out += view.getUint8(offset + i).toString(16).padStart(2, '0')
  return out
}

/** Parses Apple iBeacon manufacturer data (company 0x004C, type 0x02 0x15). */
export function parseIBeacon(data: DataView) {
  if (data.byteLength < 23 || data.getUint8(0) !== 0x02 || data.getUint8(1) !== 0x15) return null
  const raw = hex(data, 2, 16)
  const uuid = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
  return {
    uuid,
    major: data.getUint16(18),
    minor: data.getUint16(20),
    txPower: data.getInt8(22),
  }
}

/** Parses an Eddystone-UID frame (frame type 0x00). */
export function parseEddystoneUid(data: DataView) {
  if (data.byteLength < 18 || data.getUint8(0) !== 0x00) return null
  return {
    // Eddystone advertises calibrated power at 0 m; ~41 dB of loss to 1 m.
    txPower: data.getInt8(1) - 41,
    namespace: hex(data, 2, 10),
    instance: hex(data, 12, 6),
  }
}

/** Builds lookup keys so advertisements resolve to venue beacon ids. */
export function beaconIndex(beacons: Beacon[]) {
  const index = new Map<string, Beacon>()
  for (const b of beacons) {
    if (b.ibeacon) index.set(`ib:${b.ibeacon.uuid.toLowerCase()}:${b.ibeacon.major}:${b.ibeacon.minor}`, b)
    if (b.eddystone) index.set(`ed:${b.eddystone.namespace.toLowerCase()}:${b.eddystone.instance.toLowerCase()}`, b)
  }
  return index
}

type LEScanBluetooth = Bluetooth & {
  requestLEScan?: (options: BluetoothLEScanOptions) => Promise<BluetoothLEScan>
}

/**
 * Real hardware scanner using the Web Bluetooth Scanning API
 * (Chrome/Edge with experimental web platform features, Android/desktop).
 * Native shells (Capacitor/React Native) can provide the same interface.
 */
export class WebBluetoothBeaconScanner implements BeaconScanner {
  readonly label = 'Bluetooth beacons'
  private scan: BluetoothLEScan | null = null
  private listener: ((event: Event) => void) | null = null

  constructor(private readonly beacons: Beacon[]) {}

  static isSupported() {
    const bt = (typeof navigator !== 'undefined' ? navigator.bluetooth : undefined) as LEScanBluetooth | undefined
    return Boolean(bt && typeof bt.requestLEScan === 'function')
  }

  async start(onSighting: (s: BeaconSighting) => void) {
    const bt = navigator.bluetooth as LEScanBluetooth
    if (!bt?.requestLEScan) {
      throw new Error('Bluetooth scanning is not available in this browser. Enable experimental web platform features or use the native shell.')
    }
    const index = beaconIndex(this.beacons)
    this.scan = await bt.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: true })
    this.listener = (raw: Event) => {
      const event = raw as BluetoothAdvertisingEvent
      if (typeof event.rssi !== 'number') return
      const apple = event.manufacturerData?.get(APPLE_COMPANY_ID)
      if (apple) {
        const ib = parseIBeacon(apple)
        const beacon = ib && index.get(`ib:${ib.uuid}:${ib.major}:${ib.minor}`)
        if (beacon && ib) onSighting({ beaconId: beacon.id, rssi: event.rssi, txPower: ib.txPower, at: Date.now() })
        return
      }
      for (const [uuid, data] of event.serviceData ?? new Map()) {
        if (!String(uuid).startsWith(`0000${EDDYSTONE_SERVICE.toString(16)}`)) continue
        const ed = parseEddystoneUid(data)
        const beacon = ed && index.get(`ed:${ed.namespace}:${ed.instance}`)
        if (beacon && ed) onSighting({ beaconId: beacon.id, rssi: event.rssi, txPower: ed.txPower, at: Date.now() })
      }
    }
    bt.addEventListener('advertisementreceived', this.listener)
  }

  stop() {
    if (this.listener) navigator.bluetooth?.removeEventListener('advertisementreceived', this.listener)
    this.scan?.stop()
    this.scan = null
    this.listener = null
  }
}

/** Deterministic PRNG (mulberry32) so simulations and tests are repeatable. */
export function seededRandom(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(random: () => number) {
  const u = Math.max(random(), 1e-12)
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export interface WalkPoint {
  levelId: string
  position: Point
}

/**
 * Generates realistic noisy beacon sightings for a person at `where()`.
 * Used for demos without hardware and for repeatable tests.
 */
export function simulateSightings(
  beacons: Beacon[],
  where: WalkPoint,
  at: number,
  random: () => number,
  options: { noiseDb?: number; rangeM?: number; n?: number; floorLossDb?: number } = {},
): BeaconSighting[] {
  const noise = options.noiseDb ?? 3
  const range = options.rangeM ?? 30
  const n = options.n ?? 2.2
  const out: BeaconSighting[] = []
  for (const beacon of beacons) {
    const sameFloor = beacon.levelId === where.levelId
    const d = distance(beacon.position, where.position)
    if (d > range) continue
    const floorLoss = sameFloor ? 0 : (options.floorLossDb ?? 18)
    const rssi = distanceToRssi(d, beacon.txPower, n) - floorLoss + gaussian(random) * noise
    if (rssi < -98) continue
    out.push({ beaconId: beacon.id, rssi, at })
  }
  return out
}

/** Scanner that plays sightings for a scripted walk, e.g. along a route. */
export class SimulatedBeaconScanner implements BeaconScanner {
  readonly label = 'Simulated walk'
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly random: () => number

  constructor(
    private readonly beacons: Beacon[],
    private readonly where: () => WalkPoint | null,
    private readonly hz = 4,
    seed = 7,
  ) {
    this.random = seededRandom(seed)
  }

  async start(onSighting: (s: BeaconSighting) => void) {
    this.stop()
    this.timer = setInterval(() => {
      const point = this.where()
      if (!point) return
      for (const s of simulateSightings(this.beacons, point, Date.now(), this.random)) onSighting(s)
    }, 1000 / this.hz)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

/** Interpolates a position along a multi-level polyline at `meters` travelled. */
export function pointAlong(path: WalkPoint[], meters: number): WalkPoint | null {
  if (!path.length) return null
  let remaining = meters
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    if (a.levelId !== b.levelId) {
      // Vertical transition: treat as a 6 m equivalent pause at the connector.
      if (remaining <= 6) return remaining < 3 ? a : b
      remaining -= 6
      continue
    }
    const seg = distance(a.position, b.position)
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg
      return {
        levelId: a.levelId,
        position: [a.position[0] + (b.position[0] - a.position[0]) * t, a.position[1] + (b.position[1] - a.position[1]) * t],
      }
    }
    remaining -= seg
  }
  return path[path.length - 1]
}
