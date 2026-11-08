// Parity protocol wrapper around the Java runner: JSON fixture on stdin -> {"out": raw upstream string|null}.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  const f = JSON.parse(raw)
  const file = f.radiomap.startsWith('rea/') ? join(here, '../..', f.radiomap) : join(here, '../../third_party/anyplace/data', f.radiomap)
  const stdin = f.scan.map((s) => `${s.bssid} ${s.rss}`).join('\n')
  const r = spawnSync('java', ['-cp', join(here, '.classes'), 'Runner', file, String(f.algorithm)], { input: stdin, encoding: 'utf8' })
  if (r.status !== 0) {
    process.stderr.write(r.stderr)
    process.exit(1)
  }
  // Upstream returns "x y" (Java Double.toString); emit the two doubles so a 1-ulp libm difference in
  // Math.exp (HotSpot intrinsic vs V8) can be compared with a tolerance far below float32 precision.
  process.stdout.write(JSON.stringify({ out: r.stdout === 'null' ? null : r.stdout.split(' ').map(Number) }))
})
