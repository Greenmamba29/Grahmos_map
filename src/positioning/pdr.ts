/**
 * Pedestrian dead reckoning: steps from the accelerometer, heading from the OS's fused orientation
 * (Android rotation vector / iOS CoreMotion — the platform AHRS), each step a displacement on the venue
 * grid. PositioningEngine.applyStep() fuses it with BLE fixes, so the blue dot keeps moving smoothly
 * between beacon updates and through beacon dead zones.
 */

export interface StepEvent {
  at: number
  /** Metres (Weinberg estimate). */
  length: number
}

export interface StepDetectorOptions {
  /** Peak must exceed gravity by this much (m/s²). */
  threshold?: number
  /** Fastest plausible cadence: ~4 steps/s. */
  minIntervalMs?: number
  /** Weinberg constant K in L = K·(aMax − aMin)^¼; ~0.48 for phones held in hand. */
  weinbergK?: number
  /** Low-pass smoothing factor for the acceleration magnitude (0..1). */
  alpha?: number
}

const G = 9.80665

/** Peak detector on |acceleration| with a refractory period and Weinberg step length. */
export class StepDetector {
  private readonly threshold: number
  private readonly minInterval: number
  private readonly k: number
  private readonly alpha: number
  private filtered = G
  private prev = G
  private rising = false
  private lastStepAt = -Infinity
  private windowMin = G
  private windowMax = G

  constructor(options: StepDetectorOptions = {}) {
    this.threshold = options.threshold ?? 1.2
    this.minInterval = options.minIntervalMs ?? 250
    this.k = options.weinbergK ?? 0.48
    this.alpha = options.alpha ?? 0.35
  }

  /** Feed one accelerometer sample (m/s², gravity included). Returns a step when one completes. */
  push(ax: number, ay: number, az: number, at: number): StepEvent | null {
    const magnitude = Math.hypot(ax, ay, az)
    this.filtered += this.alpha * (magnitude - this.filtered)
    const v = this.filtered
    this.windowMin = Math.min(this.windowMin, v)
    this.windowMax = Math.max(this.windowMax, v)
    let step: StepEvent | null = null
    if (v > this.prev) this.rising = true
    else if (this.rising && v < this.prev) {
      // Local maximum at `prev`.
      this.rising = false
      if (this.prev - G > this.threshold && at - this.lastStepAt >= this.minInterval) {
        const swing = Math.max(0, this.windowMax - this.windowMin)
        step = { at, length: Math.min(1.1, Math.max(0.35, this.k * Math.pow(swing, 0.25))) }
        this.lastStepAt = at
        this.windowMin = v
        this.windowMax = v
      }
    }
    this.prev = v
    return step
  }
}

/**
 * Converts a compass heading (degrees clockwise from true north) and a step into a displacement on the
 * venue grid (x east, y south), given the grid's rotation from north-up (venue.anchor.bearing).
 */
export function stepDisplacement(headingDeg: number, length: number, gridBearingDeg = 0): [number, number] {
  const h = ((headingDeg - gridBearingDeg) * Math.PI) / 180
  return [Math.sin(h) * length, -Math.cos(h) * length]
}

/** Heading from a DeviceOrientationEvent: iOS webkitCompassHeading, else absolute alpha (counter-clockwise). */
export function headingFromOrientation(e: { alpha: number | null; absolute?: boolean; webkitCompassHeading?: number }): number | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) return e.webkitCompassHeading
  if (e.absolute && typeof e.alpha === 'number') return (360 - e.alpha) % 360
  return null
}
