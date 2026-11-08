// Inputs only. Scans are real recorded fingerprints (raw radio map rows) from the CSUCY building, held
// against the floor's MEAN radio map, plus edge cases. Expected values come from running upstream Java.
import { readFileSync, writeFileSync } from 'node:fs'

const raw = readFileSync(new URL('../../third_party/anyplace/data/CSUCY/0/indoor-radiomap.txt', import.meta.url), 'utf8').split('\n')
const macs = raw[1].replace('# ', '').split(', ').slice(3)
const rows = raw.slice(2).filter((l) => l.trim())
const scanFrom = (line) => {
  const v = line.split(', ').slice(3).map(Number)
  return macs.map((bssid, i) => ({ bssid, rss: Math.round(v[i]) })).filter((s) => s.rss > -110)
}
const fixtures = []
const step = Math.floor(rows.length / 12)
for (let k = 0; k < 12; k++) {
  const scan = scanFrom(rows[k * step])
  for (const algorithm of [1, 2, 3, 4]) fixtures.push({ name: `floor 0 raw scan ${k} algorithm ${algorithm}`, input: { radiomap: 'CSUCY/0/indoor-radiomap-mean.txt', algorithm, scan } })
}
const strong = scanFrom(rows[5]).sort((a, b) => b.rss - a.rss)
for (const algorithm of [1, 2, 3, 4]) {
  fixtures.push({ name: `top-3 APs only, algorithm ${algorithm}`, input: { radiomap: 'CSUCY/0/indoor-radiomap-mean.txt', algorithm, scan: strong.slice(0, 3) } })
  fixtures.push({ name: `no known APs, algorithm ${algorithm}`, input: { radiomap: 'CSUCY/0/indoor-radiomap-mean.txt', algorithm, scan: [{ bssid: 'ff:ff:ff:ff:ff:ff', rss: -40 }] } })
  fixtures.push({ name: `empty scan, algorithm ${algorithm}`, input: { radiomap: 'CSUCY/0/indoor-radiomap-mean.txt', algorithm, scan: [] } })
  fixtures.push({ name: `floor 2 map with floor 0 scan, algorithm ${algorithm}`, input: { radiomap: 'CSUCY/2/indoor-radiomap-mean.txt', algorithm, scan: scanFrom(rows[3]) } })
  fixtures.push({ name: `duplicate bssid in scan (first wins), algorithm ${algorithm}`, input: { radiomap: 'CSUCY/0/indoor-radiomap-mean.txt', algorithm, scan: [strong[0], { ...strong[0], rss: -30 }, ...strong.slice(1, 6)] } })
  fixtures.push({ name: `uppercase bssid does not match, algorithm ${algorithm}`, input: { radiomap: 'CSUCY/0/indoor-radiomap-mean.txt', algorithm, scan: strong.slice(0, 6).map((s) => ({ ...s, bssid: s.bssid.toUpperCase() })) } })
}
fixtures.push({ name: 'unknown algorithm 5', input: { radiomap: 'CSUCY/0/indoor-radiomap-mean.txt', algorithm: 5, scan: strong.slice(0, 4) } })
writeFileSync(new URL('./fixtures.json', import.meta.url), JSON.stringify(fixtures, null, 1) + '\n')
console.log(`${fixtures.length} fixtures`)
