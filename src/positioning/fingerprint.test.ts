import { describe, expect, it } from 'vitest'
import goldenJson from '../../rea/anyplace/golden.json'
import { javaHashMapOrder, locateCompat, locateFingerprint, parseRadioMap, type Reading } from './fingerprint'

const golden = goldenJson as unknown as {
  name: string
  input: { radiomap: string; algorithm: number; scan: Reading[] }
  expected: { value: { out: [number, number] | null } }
}[]
const vendored = import.meta.glob('../../third_party/anyplace/data/CSUCY/*/indoor-radiomap-mean.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const local = import.meta.glob('../../rea/anyplace/data/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const readMap = (name: string) =>
  parseRadioMap(name.startsWith('rea/') ? local[`../../${name}`] : vendored[`../../third_party/anyplace/data/${name}`])!
const map0 = readMap('CSUCY/0/indoor-radiomap-mean.txt')
const ties = readMap('rea/anyplace/data/ties.txt')
const g = (name: string) => golden.find((c) => c.name === name)!
const dist = (a: { x: number; y: number }, b: [number, number]) => Math.hypot(a.x - b[0], a.y - b[1])

describe('anyplace fingerprint port (golden from unmodified Java)', () => {
  it('reproduces every golden case through locateCompat', () => {
    for (const c of golden) {
      const rm = readMap(c.input.radiomap)
      const out = locateCompat(rm, c.input.scan, c.input.algorithm)
      const want = c.expected.value.out
      if (want === null) expect(out, c.name).toBeNull()
      else {
        const got = out!.split(' ').map(Number)
        expect(Math.abs(got[0] - want[0]), c.name).toBeLessThan(1e-9)
        expect(Math.abs(got[1] - want[1]), c.name).toBeLessThan(1e-9)
      }
    }
  })

  it('emulates java.util.HashMap iteration order (bucket, then insertion)', () => {
    expect(javaHashMapOrder(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(new Set(javaHashMapOrder(['35.1 33.4', '35.2 33.5', '35.3 33.6'])).size).toBe(3)
  })
})

describe('GrahmOS fingerprint layer: deliberate differences from upstream', () => {

  it('quirk "uppercase bssid does not match": upstream finds nothing, GrahmOS matches case-insensitively', () => {
    const c = g('uppercase bssid does not match, algorithm 2')
    expect(c.expected.value.out).toBeNull()
    expect(locateFingerprint(map0, c.input.scan, { algorithm: 'wknn' })).not.toBeNull()
  })

  it('quirk "duplicate bssid (first wins)": GrahmOS keeps the strongest reading instead', () => {
    const c = g('duplicate bssid in scan (first wins), algorithm 1')
    const [first, louder, ...rest] = c.input.scan
    const strongestFirst = [louder.rss > first.rss ? louder : first, ...rest]
    expect(locateFingerprint(map0, c.input.scan, { algorithm: 'knn' })).toEqual(locateFingerprint(map0, strongestFirst, { algorithm: 'knn' }))
    // Upstream used the weaker first reading, so its answer differs from the strongest-reading answer.
    expect(locateCompat(map0, strongestFirst, 1)).not.toBe(locateCompat(map0, c.input.scan, 1))
  })

  it('quirk "MAP/MMSE sigma is the KNN constant 4": GrahmOS sigma is configurable and changes the answer', () => {
    const text = ['# NaN -110', '# X, Y, HEADING, a1, a2, a3', '0, 0, 0, -50, -50, -50', '10, 0, 0, -60, -60, -60'].join('\n')
    const rm = parseRadioMap(text)!
    const reading = ['a1', 'a2', 'a3'].map((bssid) => ({ bssid, rss: -54 }))
    const upstream = locateCompat(rm, reading, 4)!.split(' ').map(Number) as [number, number]
    expect(dist(locateFingerprint(rm, reading, { algorithm: 'mmse', sigma: 4 })!, upstream)).toBeLessThan(1e-9)
    expect(dist(locateFingerprint(rm, reading, { algorithm: 'mmse', sigma: 8 })!, upstream)).toBeGreaterThan(0.5)
  })

  it('quirk "ties follow Java HashMap order": GrahmOS breaks ties by key, independent of hash order', () => {
    // 27 locations share the scan's exact fingerprint; KNN averages 4 of them, so order decides which 4.
    const c = g('ties: identical fingerprints, iteration order decides, algorithm 1')
    const reversed = { ...ties, rss: new Map([...ties.rss].reverse()) }
    const ours = locateFingerprint(ties, c.input.scan, { algorithm: 'knn', k: 4 })!
    expect(locateFingerprint(reversed, c.input.scan, { algorithm: 'knn', k: 4 })).toEqual(ours)
    const tied = [...ties.rss].filter(([, v]) => v.join() === '-60,-70,-80').map(([k]) => k.split(' ').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const firstFour = tied.slice(0, 4)
    expect(ours.x).toBeCloseTo(firstFour.reduce((s, p) => s + p[0], 0) / 4, 9)
    expect(ours.y).toBeCloseTo(firstFour.reduce((s, p) => s + p[1], 0) / 4, 9)
    // Upstream averaged whichever 4 tied keys reverse HashMap order put first.
    expect(dist(ours, c.expected.value.out!)).toBeGreaterThan(1e-4)
  })

  it('quirk "MMSE multiplies raw probabilities": GrahmOS uses log-space so long fingerprints do not underflow', () => {
    // A matches perfectly on the last 100 APs; the first 100 are equally poor for both locations. Upstream's
    // product underflows and freezes ("do not allow zero") before it reaches the APs that tell them apart.
    const macs = Array.from({ length: 200 }, (_, i) => `aa:00:00:00:00:${i.toString(16).padStart(3, '0')}`)
    const row = (f: (i: number) => number) => macs.map((_, i) => String(f(i))).join(', ')
    const text = ['# NaN -110', `# X, Y, HEADING, ${macs.join(', ')}`, `1, 1, 0, ${row(() => -50)}`, `3, 3, 0, ${row((i) => (i < 100 ? -80 : -35))}`].join('\n')
    const rm = parseRadioMap(text)!
    const reading = macs.map((bssid, i) => ({ bssid, rss: i < 100 ? -65 : -50 }))
    expect(locateCompat(rm, reading, 4)).toBe('2.0 2.0')
    const ours = locateFingerprint(rm, reading, { algorithm: 'mmse', sigma: 4 })!
    expect(ours.x).toBeCloseTo(1, 6)
    expect(ours.y).toBeCloseTo(1, 6)
  })

  it('returns null with no known access points, like upstream', () => {
    expect(locateFingerprint(map0, [{ bssid: 'ff:ff:ff:ff:ff:ff', rss: -40 }])).toBeNull()
  })
})
