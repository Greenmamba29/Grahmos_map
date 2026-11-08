/**
 * Fingerprint positioning ported from anyplace (server/app/location/Algorithms.java + RadioMap.java @
 * 7229551, MIT, DMSL University of Cyprus). Works with any RSSI source: Wi-Fi (Android native) or BLE
 * beacons, using a radio map of recorded fingerprints instead of beacon geometry.
 *
 * `locateCompat` reproduces upstream exactly, quirks included (proven by rea/anyplace/golden.json):
 *  - MAP/MMSE use the KNN constant "4" as their Gaussian sigma (the RBF values in the parameters file are
 *    never read);
 *  - WKNN/MMSE parse coordinates as 32-bit floats, KNN as doubles;
 *  - ties follow Java HashMap iteration order;
 *  - BSSIDs match case-sensitively; the first reading of a repeated BSSID wins.
 * `locateFingerprint` is the GrahmOS layer on top; each difference from upstream has a named test.
 */

export interface RadioMap {
  nan: string
  macs: string[]
  /** "x y" key (exactly as written in the file) → RSS strings, one per MAC. */
  rss: Map<string, string[]>
  /** Iteration order of upstream's java.util.HashMap over `rss`. */
  javaOrder: string[]
}

export interface Reading {
  bssid: string
  rss: number
}

export function parseRadioMap(text: string): RadioMap | null {
  const lines = text.split(/\r?\n/)
  const first = lines[0]?.split(' ') ?? []
  if (first[1] !== 'NaN') return null
  const nan = first[2]
  const header = lines[1]
  if (header === undefined) return null
  const head = header.replace(/, /g, ' ').split(' ')
  if (head.length < 4) return null
  const macs = head.slice(4)
  const rss = new Map<string, string[]>()
  for (const line of lines.slice(2)) {
    if (line.trim() === '') continue
    const t = line.replace(/, /g, ' ').split(' ')
    if (t.length < 4) return null
    const values = t.slice(3)
    if (values.length !== macs.length) return null
    rss.set(`${t[0]} ${t[1]}`, values)
  }
  return { nan, macs, rss, javaOrder: javaHashMapOrder([...rss.keys()]) }
}

/** java.lang.String#hashCode */
function javaStringHash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return h
}

/**
 * Iteration order of a java.util.HashMap (default capacity 16, load factor 0.75) after inserting `keys`
 * in order: by bucket (spread hash & (capacity − 1)), insertion order within a bucket.
 */
export function javaHashMapOrder(keys: string[]) {
  let capacity = 16
  while (keys.length > capacity * 0.75) capacity *= 2
  return keys
    .map((key, index) => {
      const h = javaStringHash(key)
      return { key, index, bucket: (h ^ (h >>> 16)) & (capacity - 1) }
    })
    .sort((a, b) => a.bucket - b.bucket || a.index - b.index)
    .map((e) => e.key)
}

const f32 = Math.fround
/** Java Float.valueOf(str.trim()); NaN for unparsable input (upstream then returns null / −∞). */
const javaFloat = (s: string) => f32(Number(s.trim()))
const javaDouble = (s: string) => Number(s.trim())

/** Java Double.toString for the magnitudes coordinates take (shortest repr, ".0" on integers, E notation). */
export function javaDoubleToString(x: number) {
  if (Number.isNaN(x)) return 'NaN'
  if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity'
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0'
  const abs = Math.abs(x)
  if (abs >= 1e-3 && abs < 1e7) {
    const s = String(x)
    return s.includes('.') ? s : `${s}.0`
  }
  const [mant, exp] = x.toExponential().split('e')
  return `${mant.includes('.') ? mant : `${mant}.0`}E${Number(exp)}`
}

const K = '4'

/** Upstream-exact: returns the same "x y" string Algorithms.ProcessingAlgorithms returns, or null. */
export function locateCompat(rm: RadioMap, scan: Reading[], algorithm: number): string | null {
  const observed: string[] = []
  let notFound = 0
  for (const mac of rm.macs) {
    const hit = scan.find((r) => r.bssid === mac)
    if (hit) observed.push(String(hit.rss))
    else {
      observed.push(rm.nan)
      notFound++
    }
  }
  if (notFound === rm.macs.length) return null
  switch (algorithm) {
    case 1:
      return knn(rm, observed, false)
    case 2:
      return knn(rm, observed, true)
    case 3:
      return mapMmse(rm, observed, false)
    case 4:
      return mapMmse(rm, observed, true)
    default:
      return null
  }
}

function euclidean(a: string[], b: string[]) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = javaDouble(a[i]) - javaDouble(b[i])
    if (Number.isNaN(d)) return -Infinity
    sum += d * d
  }
  return Math.sqrt(sum)
}

function knn(rm: RadioMap, observed: string[], weighted: boolean) {
  const k = Number.parseInt(K, 10)
  const list: { d: number; loc: string }[] = []
  for (const loc of rm.javaOrder) {
    const d = euclidean(rm.rss.get(loc)!, observed)
    if (d === -Infinity) return null
    list.unshift({ d, loc })
  }
  // Collections.sort is stable; Array.prototype.sort is stable too.
  list.sort((a, b) => (a.d > b.d ? 1 : a.d === b.d ? 0 : -1))
  const kMin = Math.min(k, list.length)
  if (!weighted) {
    let sx = 0
    let sy = 0
    for (let i = 0; i < kMin; i++) {
      const [x, y] = list[i].loc.split(' ')
      sx += javaDouble(x)
      sy += javaDouble(y)
    }
    return `${javaDoubleToString(sx / kMin)} ${javaDoubleToString(sy / kMin)}`
  }
  let sw = 0
  let wx = 0
  let wy = 0
  for (let i = 0; i < kMin; i++) {
    const w = list[i].d !== 0 ? 1 / list[i].d : 100
    const [xs, ys] = list[i].loc.split(' ')
    const x = javaFloat(xs)
    const y = javaFloat(ys)
    if (Number.isNaN(x) || Number.isNaN(y)) return null
    sw += w
    wx += w * x
    wy += w * y
  }
  return `${javaDoubleToString(wx / sw)} ${javaDoubleToString(wy / sw)}`
}

function probability(a: string[], b: string[], sigma: number) {
  let result = 1
  const s2 = f32(sigma * sigma)
  for (let i = 0; i < a.length; i++) {
    const v1 = javaFloat(a[i])
    const v2 = javaFloat(b[i])
    if (Number.isNaN(v1) || Number.isNaN(v2)) return -Infinity
    let t = f32(v1 - v2)
    t *= t
    t = -t
    t /= s2
    t = Math.exp(t)
    if (result * t !== 0) result *= t
  }
  return result
}

function mapMmse(rm: RadioMap, observed: string[], weighted: boolean) {
  const sigma = javaFloat(K)
  let best = -Infinity
  let location: string | null = null
  const list: { p: number; loc: string }[] = []
  for (const loc of rm.javaOrder) {
    const p = probability(rm.rss.get(loc)!, observed, sigma)
    if (p === -Infinity) return null
    if (p > best) {
      best = p
      location = loc
    }
    if (weighted) list.unshift({ p, loc })
  }
  if (!weighted) return location
  let sum = 0
  for (const e of list) sum += e.p
  let wx = 0
  let wy = 0
  for (const e of list) {
    const [xs, ys] = e.loc.split(' ')
    const x = javaFloat(xs)
    const y = javaFloat(ys)
    if (Number.isNaN(x) || Number.isNaN(y)) return null
    const np = e.p / sum
    wx += x * np
    wy += y * np
  }
  return `${javaDoubleToString(wx)} ${javaDoubleToString(wy)}`
}

export type FingerprintAlgorithm = 'knn' | 'wknn' | 'map' | 'mmse'

export interface FingerprintOptions {
  algorithm?: FingerprintAlgorithm
  k?: number
  /** Gaussian sigma in dB for MAP/MMSE (upstream accidentally used 4). */
  sigma?: number
}

/**
 * GrahmOS layer: numbers instead of strings, BSSIDs matched case-insensitively, the strongest reading of a
 * repeated BSSID kept, configurable K and sigma, and ties broken by distance then key (not hash order).
 */
export function locateFingerprint(rm: RadioMap, scan: Reading[], options: FingerprintOptions = {}): { x: number; y: number } | null {
  const algorithm = options.algorithm ?? 'wknn'
  const k = Math.max(1, options.k ?? 4)
  const sigma = options.sigma ?? 6
  const strongest = new Map<string, number>()
  for (const r of scan) {
    const mac = r.bssid.toLowerCase()
    strongest.set(mac, Math.max(strongest.get(mac) ?? -Infinity, r.rss))
  }
  const nan = Number(rm.nan)
  let known = 0
  const observed = rm.macs.map((mac) => {
    const v = strongest.get(mac.toLowerCase())
    if (v === undefined) return nan
    known++
    return v
  })
  if (!known) return null
  const points = [...rm.rss.keys()]
    .sort()
    .map((key) => {
      const values = rm.rss.get(key)!.map(Number)
      const [x, y] = key.split(' ').map(Number)
      let d2 = 0
      let logp = 0
      for (let i = 0; i < values.length; i++) {
        const diff = values[i] - observed[i]
        d2 += diff * diff
        logp -= (diff * diff) / (sigma * sigma)
      }
      return { x, y, d: Math.sqrt(d2), logp }
    })
  if (algorithm === 'knn' || algorithm === 'wknn') {
    const nearest = [...points].sort((a, b) => a.d - b.d).slice(0, k)
    const weight = (d: number) => (algorithm === 'knn' ? 1 : d === 0 ? 100 : 1 / d)
    const sw = nearest.reduce((s, p) => s + weight(p.d), 0)
    return { x: nearest.reduce((s, p) => s + weight(p.d) * p.x, 0) / sw, y: nearest.reduce((s, p) => s + weight(p.d) * p.y, 0) / sw }
  }
  const maxLog = Math.max(...points.map((p) => p.logp))
  if (algorithm === 'map') {
    const best = points.find((p) => p.logp === maxLog)!
    return { x: best.x, y: best.y }
  }
  // MMSE with log-sum-exp so long fingerprints don't underflow to 0.
  const weights = points.map((p) => Math.exp(p.logp - maxLog))
  const sw = weights.reduce((s, w) => s + w, 0)
  return {
    x: points.reduce((s, p, i) => s + weights[i] * p.x, 0) / sw,
    y: points.reduce((s, p, i) => s + weights[i] * p.y, 0) / sw,
  }
}
