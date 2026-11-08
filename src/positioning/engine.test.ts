import { describe, expect, it } from 'vitest'
import { createDemoVenue } from '../indoor/demoVenue'
import { distance } from '../indoor/geometry'
import { PositioningEngine, multilaterate, rssiToDistance, distanceToRssi } from './engine'
import { parseEddystoneUid, parseIBeacon, pointAlong, seededRandom, simulateSightings } from './scanners'

const venue = createDemoVenue()

describe('path loss model', () => {
  it('inverts cleanly', () => {
    expect(rssiToDistance(distanceToRssi(7, -59), -59)).toBeCloseTo(7, 5)
  })
})

describe('multilaterate', () => {
  it('recovers a position from exact ranges', () => {
    const truth: [number, number] = [12, 7]
    const anchors: [number, number][] = [[0, 0], [30, 0], [0, 20], [30, 20]]
    const { position } = multilaterate(anchors.map((p) => ({ position: p, distance: distance(p, truth), weight: 1 })))
    expect(distance(position, truth)).toBeLessThan(0.05)
  })
})

describe('PositioningEngine', () => {
  it('tracks a simulated walker to within a few metres and the right floor', () => {
    const engine = new PositioningEngine(venue.beacons)
    const random = seededRandom(42)
    const truth = { levelId: 'L2', position: [30, 25] as [number, number] }
    let last = null
    for (let t = 0; t < 4000; t += 250) {
      for (const s of simulateSightings(venue.beacons, truth, t, random)) engine.ingest(s)
      last = engine.estimate(t)
    }
    expect(last!.levelId).toBe('L2')
    expect(distance(last!.position, truth.position)).toBeLessThan(5)
  })

  it('switches floors with hysteresis', () => {
    const engine = new PositioningEngine(venue.beacons, { windowMs: 500 })
    const random = seededRandom(1)
    const run = (levelId: string, from: number) => {
      let est = null
      for (let t = from; t < from + 2000; t += 250) {
        for (const s of simulateSightings(venue.beacons, { levelId, position: [39, 25] }, t, random)) engine.ingest(s)
        est = engine.estimate(t)
      }
      return est
    }
    expect(run('L1', 0)!.levelId).toBe('L1')
    expect(run('L3', 2000)!.levelId).toBe('L3')
  })
})

describe('advertisement parsers', () => {
  it('parses iBeacon frames', () => {
    const bytes = new Uint8Array([0x02, 0x15, ...Array(16).fill(0xab), 0x00, 0x02, 0x00, 0x07, 0xc5])
    const parsed = parseIBeacon(new DataView(bytes.buffer))!
    expect(parsed.major).toBe(2)
    expect(parsed.minor).toBe(7)
    expect(parsed.txPower).toBe(-59)
    expect(parsed.uuid).toMatch(/^abababab-abab-abab-abab-abababababab$/)
  })

  it('parses Eddystone-UID frames', () => {
    const bytes = new Uint8Array([0x00, 0xee, ...Array(10).fill(0x01), ...Array(6).fill(0x02), 0, 0])
    const parsed = parseEddystoneUid(new DataView(bytes.buffer))!
    expect(parsed.namespace).toBe('01'.repeat(10))
    expect(parsed.instance).toBe('02'.repeat(6))
  })
})

describe('pointAlong', () => {
  it('interpolates along a path', () => {
    const p = pointAlong([{ levelId: 'L1', position: [0, 0] }, { levelId: 'L1', position: [10, 0] }], 4)!
    expect(p.position[0]).toBeCloseTo(4)
  })
})
