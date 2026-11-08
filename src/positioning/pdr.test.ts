import { describe, expect, it } from 'vitest'
import { createDemoVenue } from '../indoor/demoVenue'
import { distance } from '../indoor/geometry'
import { PositioningEngine } from './engine'
import { headingFromOrientation, StepDetector, stepDisplacement } from './pdr'
import { seededRandom, simulateSightings } from './scanners'

const G = 9.80665
/** Synthetic hand-held walking: vertical bounce at `cadence` Hz plus sensor noise, 50 Hz sampling. */
function walkSignal(steps: number, cadence = 1.8, amplitude = 2.6, noise = 0.35, seed = 5) {
  const rnd = seededRandom(seed)
  const samples: [number, number, number, number][] = []
  const duration = steps / cadence
  for (let t = 0; t < duration; t += 0.02) {
    const n = () => (rnd() - 0.5) * 2 * noise
    samples.push([n(), n(), G + amplitude * Math.sin(2 * Math.PI * cadence * t) + n(), t * 1000])
  }
  return samples
}

describe('StepDetector', () => {
  it('counts steps in a noisy walking signal within ±1', () => {
    const d = new StepDetector()
    const steps = walkSignal(24).map(([x, y, z, t]) => d.push(x, y, z, t)).filter(Boolean)
    expect(steps.length).toBeGreaterThanOrEqual(23)
    expect(steps.length).toBeLessThanOrEqual(25)
    for (const s of steps) {
      expect(s!.length).toBeGreaterThan(0.4)
      expect(s!.length).toBeLessThan(1.0)
    }
  })

  it('stays quiet while the phone rests (noise only)', () => {
    const d = new StepDetector()
    const steps = walkSignal(20, 1.8, 0, 0.35).map(([x, y, z, t]) => d.push(x, y, z, t)).filter(Boolean)
    expect(steps).toHaveLength(0)
  })

  it('ignores impossible cadence (vibration at 12 Hz)', () => {
    const d = new StepDetector()
    const steps = walkSignal(60, 12, 2.6, 0.1).map(([x, y, z, t]) => d.push(x, y, z, t)).filter(Boolean)
    // 60 vibration peaks in 5 s; refractory period caps detections at ~4/s.
    expect(steps.length).toBeLessThanOrEqual(21)
  })
})

describe('stepDisplacement', () => {
  it('maps compass headings onto the venue grid (x east, y south)', () => {
    const [ex, ey] = stepDisplacement(90, 1)
    expect(ex).toBeCloseTo(1)
    expect(ey).toBeCloseTo(0)
    const [nx, ny] = stepDisplacement(0, 1)
    expect(ny).toBeCloseTo(-1)
    expect(nx).toBeCloseTo(0)
    // A grid rotated 90° clockwise: walking east is walking "north" on the grid.
    const [rx, ry] = stepDisplacement(90, 1, 90)
    expect(ry).toBeCloseTo(-1)
    expect(rx).toBeCloseTo(0)
  })

  it('reads iOS compass headings and absolute Android alpha', () => {
    expect(headingFromOrientation({ alpha: 10, webkitCompassHeading: 270 })).toBe(270)
    expect(headingFromOrientation({ alpha: 90, absolute: true })).toBe(270)
    expect(headingFromOrientation({ alpha: 90, absolute: false })).toBeNull()
  })
})

describe('BLE + PDR fusion', () => {
  it('tracks a walker through a beacon dead zone better than BLE alone', () => {
    const venue = createDemoVenue()
    // Only the two corridor end beacons on L1 survive: the middle of the corridor is a dead zone.
    const sparse = venue.beacons.filter((b) => b.levelId === 'L1' && (b.id === 'L1-b1' || b.id === 'L1-b5'))
    const run = (usePdr: boolean) => {
      const engine = new PositioningEngine(sparse)
      const rnd = seededRandom(9)
      let errSum = 0
      let n = 0
      // Walk east along the corridor at 1.3 m/s, one step every 0.55 s (0.72 m).
      for (let t = 0; t <= 40_000; t += 250) {
        const x = 4 + (t / 1000) * 1.3
        if (x > 80) break
        const truth: [number, number] = [x, 25]
        for (const s of simulateSightings(sparse, { levelId: 'L1', position: truth }, t, rnd)) engine.ingest(s)
        if (usePdr && t % 550 < 250 && t > 0) {
          const [dx, dy] = stepDisplacement(90, 0.72)
          engine.applyStep(dx, dy, t)
        }
        const est = engine.estimate(t)
        if (est && t > 3000) {
          errSum += distance(est.position, truth)
          n++
        }
      }
      return errSum / n
    }
    const bleOnly = run(false)
    const fused = run(true)
    // Measured 2026-11-08: BLE only 18.2 m, BLE+PDR 11.7 m mean error in the dead zone.
    expect(fused).toBeLessThan(bleOnly * 0.8)
  })

  it('needs a BLE fix before dead reckoning starts', () => {
    const engine = new PositioningEngine(createDemoVenue().beacons)
    expect(engine.applyStep(0.7, 0, 0)).toBeNull()
  })
})
