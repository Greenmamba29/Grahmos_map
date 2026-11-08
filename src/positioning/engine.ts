import type { Beacon, IndoorPosition, Point } from '../indoor/types'

/** A single BLE advertisement observation. */
export interface BeaconSighting {
  beaconId: string
  rssi: number
  /** Optional advertised tx power at 1 m. */
  txPower?: number
  at: number
}

export interface PositioningOptions {
  /** Path loss exponent; ~2 in open halls, 2.5–3.5 with walls and people. */
  pathLossExponent?: number
  /** Sliding window of sightings used per estimate, ms. */
  windowMs?: number
  /** Process noise for the Kalman filter, m² per second. */
  processNoise?: number
  /** Consecutive wins a new floor needs before switching (hysteresis). */
  floorHysteresis?: number
}

/** Log-distance path loss model: estimated metres from RSSI. */
export function rssiToDistance(rssi: number, txPower: number, n = 2.2): number {
  return Math.pow(10, (txPower - rssi) / (10 * n))
}

/** Inverse of {@link rssiToDistance} without noise. */
export function distanceToRssi(meters: number, txPower: number, n = 2.2): number {
  return txPower - 10 * n * Math.log10(Math.max(meters, 0.1))
}

interface Range {
  position: Point
  distance: number
  weight: number
}

/**
 * Weighted non-linear least squares multilateration (Gauss-Newton),
 * seeded with a weighted centroid. Works with any number of ranges ≥ 1.
 */
export function multilaterate(ranges: Range[]): { position: Point; residual: number } {
  const totalWeight = ranges.reduce((s, r) => s + r.weight, 0)
  let x = ranges.reduce((s, r) => s + r.position[0] * r.weight, 0) / totalWeight
  let y = ranges.reduce((s, r) => s + r.position[1] * r.weight, 0) / totalWeight
  if (ranges.length < 3) return { position: [x, y], residual: ranges[0]?.distance ?? 0 }

  for (let iter = 0; iter < 20; iter++) {
    let a11 = 0
    let a12 = 0
    let a22 = 0
    let b1 = 0
    let b2 = 0
    for (const r of ranges) {
      const dx = x - r.position[0]
      const dy = y - r.position[1]
      const d = Math.max(Math.hypot(dx, dy), 1e-6)
      const jx = dx / d
      const jy = dy / d
      const residual = d - r.distance
      a11 += r.weight * jx * jx
      a12 += r.weight * jx * jy
      a22 += r.weight * jy * jy
      b1 += r.weight * jx * residual
      b2 += r.weight * jy * residual
    }
    // Levenberg damping keeps the step stable when beacons are collinear.
    const damping = 1e-3 * (a11 + a22) + 1e-9
    a11 += damping
    a22 += damping
    const det = a11 * a22 - a12 * a12
    if (Math.abs(det) < 1e-12) break
    const stepX = (a22 * b1 - a12 * b2) / det
    const stepY = (a11 * b2 - a12 * b1) / det
    x -= stepX
    y -= stepY
    if (Math.hypot(stepX, stepY) < 1e-3) break
  }

  let residual = 0
  for (const r of ranges) {
    residual += r.weight * (Math.hypot(x - r.position[0], y - r.position[1]) - r.distance) ** 2
  }
  return { position: [x, y], residual: Math.sqrt(residual / totalWeight) }
}

/** Constant-position Kalman filter applied independently per axis. */
class Kalman2D {
  private state: Point | null = null
  private variance = 0
  private lastAt = 0

  constructor(private processNoise: number) {}

  reset() {
    this.state = null
  }

  get initialized() {
    return this.state !== null
  }

  /** Dead-reckoning prediction: move the estimate by (dx, dy) and grow its variance by `addVariance`. */
  shift(dx: number, dy: number, addVariance: number) {
    if (!this.state) return null
    this.state = [this.state[0] + dx, this.state[1] + dy]
    this.variance += addVariance
    return { position: this.state, variance: this.variance }
  }

  update(measurement: Point, measurementVariance: number, at: number): { position: Point; variance: number } {
    if (!this.state) {
      this.state = [...measurement] as Point
      this.variance = measurementVariance
      this.lastAt = at
      return { position: this.state, variance: this.variance }
    }
    const dt = Math.max(0, (at - this.lastAt) / 1000)
    this.lastAt = at
    const predicted = this.variance + this.processNoise * dt
    const gain = predicted / (predicted + measurementVariance)
    this.state = [
      this.state[0] + gain * (measurement[0] - this.state[0]),
      this.state[1] + gain * (measurement[1] - this.state[1]),
    ]
    this.variance = (1 - gain) * predicted
    return { position: this.state, variance: this.variance }
  }
}

/**
 * Turns a stream of BLE beacon sightings into a smoothed indoor position
 * with floor detection. Pure TypeScript, no network, deterministic.
 */
export class PositioningEngine {
  private readonly beacons = new Map<string, Beacon>()
  private sightings: BeaconSighting[] = []
  private readonly kalman: Kalman2D
  private levelId: string | null = null
  private candidateLevel: string | null = null
  private candidateWins = 0
  private readonly n: number
  private readonly windowMs: number
  private readonly hysteresis: number

  constructor(beacons: Beacon[], options: PositioningOptions = {}) {
    for (const beacon of beacons) this.beacons.set(beacon.id, beacon)
    this.n = options.pathLossExponent ?? 2.2
    this.windowMs = options.windowMs ?? 2500
    this.hysteresis = options.floorHysteresis ?? 2
    this.kalman = new Kalman2D(options.processNoise ?? 2.5)
  }

  get currentLevel() {
    return this.levelId
  }

  /**
   * Fuses one detected step (pdr.ts) as a Kalman prediction. Each step adds ~(0.15·length)² m² of
   * uncertainty; the next BLE estimate corrects drift. Returns the predicted position, or null before the
   * first BLE fix (dead reckoning needs a starting point).
   */
  applyStep(dx: number, dy: number, at: number): IndoorPosition | null {
    if (!this.levelId || !this.kalman.initialized) return null
    const length = Math.hypot(dx, dy)
    const r = this.kalman.shift(dx, dy, (0.15 * length) ** 2 + 0.05)
    if (!r) return null
    return { levelId: this.levelId, position: r.position, accuracy: Math.sqrt(r.variance) + 0.5, source: 'ble', at }
  }

  ingest(sighting: BeaconSighting) {
    if (!this.beacons.has(sighting.beaconId)) return
    this.sightings.push(sighting)
  }

  /** Computes an estimate from the sightings inside the window ending at `now`. */
  estimate(now: number): IndoorPosition | null {
    this.sightings = this.sightings.filter((s) => now - s.at <= this.windowMs)
    if (!this.sightings.length) return null

    // Median RSSI per beacon rejects multipath spikes.
    const byBeacon = new Map<string, number[]>()
    for (const s of this.sightings) {
      const list = byBeacon.get(s.beaconId) ?? []
      list.push(s.rssi)
      byBeacon.set(s.beaconId, list)
    }
    const observations = [...byBeacon.entries()].map(([id, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      return { beacon: this.beacons.get(id)!, rssi: median }
    })

    // Floor detection: strongest summed signal across the top three beacons.
    const levelScores = new Map<string, number>()
    for (const levelId of new Set(observations.map((o) => o.beacon.levelId))) {
      const top = observations
        .filter((o) => o.beacon.levelId === levelId)
        .map((o) => o.rssi + 100)
        .sort((a, b) => b - a)
        .slice(0, 3)
      levelScores.set(levelId, top.reduce((s, v) => s + Math.max(v, 0), 0))
    }
    const bestLevel = [...levelScores.entries()].sort((a, b) => b[1] - a[1])[0][0]
    if (this.levelId === null) {
      this.levelId = bestLevel
    } else if (bestLevel !== this.levelId) {
      if (this.candidateLevel === bestLevel) this.candidateWins++
      else {
        this.candidateLevel = bestLevel
        this.candidateWins = 1
      }
      if (this.candidateWins >= this.hysteresis) {
        this.levelId = bestLevel
        this.candidateLevel = null
        this.candidateWins = 0
        this.kalman.reset()
      }
    } else {
      this.candidateLevel = null
      this.candidateWins = 0
    }

    const ranges: Range[] = observations
      .filter((o) => o.beacon.levelId === this.levelId)
      .sort((a, b) => b.rssi - a.rssi)
      .slice(0, 6)
      .map((o) => {
        const d = rssiToDistance(o.rssi, o.beacon.txPower, this.n)
        return { position: o.beacon.position, distance: d, weight: 1 / Math.max(d * d, 0.25) }
      })
    if (!ranges.length) return null

    const { position, residual } = multilaterate(ranges)
    const measurementVariance = Math.max(1, residual * residual + (ranges.length < 3 ? 16 : 0))
    const filtered = this.kalman.update(position, measurementVariance, now)
    return {
      levelId: this.levelId!,
      position: filtered.position,
      accuracy: Math.sqrt(filtered.variance) + 0.5,
      source: 'ble',
      at: now,
    }
  }
}
