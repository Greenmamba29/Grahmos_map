// Drives a WebRTC peer library through a scripted session inside real Chromium and records what happens.
// `lib` = "upstream" (vendored simplepeer.min.js, unmodified) or "port" (src/mesh/transports/rtcPeer.ts,
// type-stripped). Both are exposed to the page as window.SimplePeer with the same constructor/API.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'
import { createRequire } from 'node:module'

// require() honours NODE_PATH (ES imports don't), so a globally installed Playwright works too.
const { chromium } = createRequire(import.meta.url)('playwright')

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')

function libSource(lib, mutant) {
  if (lib === 'upstream') return readFileSync(join(root, 'third_party/simple-peer/simplepeer.min.js'), 'utf8')
  let src = stripTypeScriptTypes(readFileSync(join(root, 'src/mesh/transports/rtcPeer.ts'), 'utf8'))
  src = src.replace(/^export /gm, '')
  if (mutant) src = src.replace('ordered: true', 'ordered: false').replace("this.emit('close')", "this.emit('end')")
  return `${src}\nwindow.SimplePeer = RtcPeer;`
}

// Runs inside the page. Returns a JSON-safe observation of the session.
async function scenario(s) {
  const log = { signals1: [], signals2: [], events: [], received: [], errors: [] }
  const describe = (d) => (typeof d === 'string' ? { kind: 'string', text: d } : { kind: d instanceof Uint8Array ? 'bytes' : typeof d, bytes: Array.from(d.subarray(0, 8)), length: d.length, text: new TextDecoder().decode(d.length > 64 ? d.subarray(0, 64) : d) })
  const opts = { trickle: s.trickle ?? false, objectMode: s.objectMode ?? false, config: { iceServers: [] } }
  const p1 = new window.SimplePeer({ ...opts, initiator: true })
  const p2 = new window.SimplePeer({ ...opts })
  p1.on('signal', (d) => { log.signals1.push(d.type ?? (d.candidate ? 'candidate' : Object.keys(d).sort().join('+'))); p2.signal(d) })
  p2.on('signal', (d) => { log.signals2.push(d.type ?? (d.candidate ? 'candidate' : Object.keys(d).sort().join('+'))); p1.signal(d) })
  for (const [name, p] of [['p1', p1], ['p2', p2]]) {
    p.on('connect', () => log.events.push(`${name}:connect`))
    p.on('close', () => log.events.push(`${name}:close`))
    p.on('error', (e) => log.errors.push(`${name}:${e.code ?? e.name}`))
  }
  if (s.sendBeforeConnect) {
    try { p1.send('too early') } catch (e) { log.errors.push(`send-before-connect:${e.code ?? e.name}`) }
  }
  const expected = (s.messages ?? []).length
  const got = new Promise((resolve) => {
    p2.on('data', (d) => { log.received.push(describe(d)); if (log.received.length >= expected) resolve() })
    if (!expected) resolve()
  })
  await new Promise((resolve, reject) => { p1.on('connect', resolve); setTimeout(() => reject(new Error('connect timeout')), 15000) })
  if (!log.events.includes('p2:connect')) await new Promise((r) => p2.once ? p2.once('connect', r) : p2.on('connect', r))
  for (const m of s.messages ?? []) p1.send(m.bytes ? new Uint8Array(m.bytes) : m.repeat ? m.text.repeat(m.repeat) : m.text)
  await Promise.race([got, new Promise((r) => setTimeout(r, 8000))])
  if (s.destroy) {
    const closed = new Promise((r) => p2.on('close', r))
    p1.destroy()
    await Promise.race([closed, new Promise((r) => setTimeout(r, 5000))])
  }
  // Trickle candidate counts depend on the machine's interfaces; record presence, not count.
  const squash = (xs) => xs.filter((x, i) => x !== 'candidate' || xs[i - 1] !== 'candidate')
  log.signals1 = squash(log.signals1)
  log.signals2 = squash(log.signals2)
  log.events.sort()
  return log
}

export async function run(lib, input, mutant = false) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><title>rea</title>')
    await page.addScriptTag({ content: libSource(lib, mutant) })
    return await page.evaluate(scenario, input)
  } finally {
    await browser.close()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let raw = ''
  process.stdin.on('data', (c) => (raw += c))
  process.stdin.on('end', async () => {
    const lib = process.argv[2] ?? 'upstream'
    process.stdout.write(JSON.stringify({ out: await run(lib, JSON.parse(raw), process.argv.includes('--mutant')) }))
  })
}
