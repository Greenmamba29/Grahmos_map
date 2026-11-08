// Parity port for anyplace: same protocol as ref.mjs, driving src/positioning/fingerprint.ts (locateCompat).
// `--mutant` uses insertion order instead of Java HashMap order (a plausible porting bug).
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { locateCompat, parseRadioMap } from '../../src/positioning/fingerprint.ts'

const here = dirname(fileURLToPath(import.meta.url))
const mutant = process.argv.includes('--mutant')
let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  const f = JSON.parse(raw)
  const rm = parseRadioMap(readFileSync(f.radiomap.startsWith('rea/') ? join(here, '../..', f.radiomap) : join(here, '../../third_party/anyplace/data', f.radiomap), 'utf8'))!
  if (mutant) rm.javaOrder = [...rm.rss.keys()]
  const out = locateCompat(rm, f.scan, f.algorithm)
  process.stdout.write(JSON.stringify({ out: out === null ? null : out.split(' ').map(Number) }))
})
