import { describe, expect, it } from 'vitest'
import { seededRandom } from '../positioning/scanners'
import { LwwMap } from './crdt'
import { HybridLogicalClock, decodeHlc } from './hlc'
import { generateKey, signPayload, type DeviceKey } from './identity'
import { MeshNode, verifiedEntry } from './node'
import { ChunkAssembler, chunkFrame, decodeEnvelope, encodeEnvelope, signedPart, type Annotation, type SignedEntry } from './protocol'
import { MemoryTransport } from './transports/memory'

/** Deterministic Ed25519 key per test name, so failures reproduce. */
function keyFor(seed: string): DeviceKey {
  const bytes = new Uint8Array(32)
  for (let i = 0; i < seed.length; i++) bytes[i % 32] = (bytes[i % 32] + seed.charCodeAt(i) * (i + 1)) & 0xff
  bytes[31] ^= seed.length
  return generateKey(bytes)
}

function meshNode(seed: string, name = seed, venueId: string | undefined = 'v') {
  return new MeshNode({ key: keyFor(seed), name, venueId })
}

function annotation(author: MeshNode, id: string, text: string, overrides: Partial<Annotation> = {}): Annotation {
  return {
    id, venueId: 'v', type: 'closure', levelId: 'L1', position: [10, 10], radius: 3, text,
    author: author.peerId, authorName: author.name, createdAt: 0, resolved: false, ...overrides,
  }
}

async function link(a: MeshNode, b: MeshNode, label: string) {
  const [left, right] = MemoryTransport.pair(`${label}-l`, `${label}-r`)
  a.addTransport(left)
  b.addTransport(right)
  await right.start()
  await left.start()
  return [left, right] as const
}

describe('HybridLogicalClock', () => {
  it('stays monotonic when the wall clock goes backwards', () => {
    let now = 1000
    const clock = new HybridLogicalClock('n', () => now)
    const a = clock.tick()
    now = 500
    const b = clock.tick()
    expect(b > a).toBe(true)
    expect(decodeHlc(b)!.wall).toBe(1000)
  })

  it('rejects remote timestamps far in the future', () => {
    const clock = new HybridLogicalClock('n', () => 0, 1000)
    const remote = new HybridLogicalClock('r', () => 10_000).tick()
    expect(clock.receive(remote)).toBe(false)
  })
})

describe('LwwMap', () => {
  it('converges regardless of merge order', () => {
    const e1 = { key: 'k', value: 1, hlc: '0000000001:0000:a' }
    const e2 = { key: 'k', value: 2, hlc: '0000000002:0000:b' }
    const x = new LwwMap([e1, e2])
    const y = new LwwMap([e2, e1])
    expect(x.get('k')).toBe(2)
    expect(y.get('k')).toBe(2)
  })
})

describe('chunked framing', () => {
  it('reassembles out-of-order packets', () => {
    const frame = JSON.stringify({ text: 'x'.repeat(1000), emoji: '🚨' })
    const packets = chunkFrame(frame, 9, 20)
    expect(packets.length).toBeGreaterThan(10)
    const assembler = new ChunkAssembler()
    let out: string | null = null
    for (const p of [...packets].reverse()) out = assembler.push(p) ?? out
    expect(out).toBe(frame)
  })
})

describe('MeshNode', () => {
  it('relays annotations across multiple hops (A ↔ B ↔ C)', async () => {
    const a = meshNode('a', 'A')
    const b = meshNode('b', 'B')
    const c = meshNode('c', 'C')
    await link(a, b, 'ab')
    await link(b, c, 'bc')
    a.publishAnnotation(annotation(a, 'closure-1', 'Smoke in corridor'))
    expect(c.activeAnnotations().map((x) => x.text)).toEqual(['Smoke in corridor'])
    expect(b.stats.relayed).toBeGreaterThan(0)
  })

  it('does not loop forever in a ring and drops duplicates', async () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => meshNode(id))
    await link(nodes[0], nodes[1], '01')
    await link(nodes[1], nodes[2], '12')
    await link(nodes[2], nodes[3], '23')
    await link(nodes[3], nodes[0], '30')
    nodes[0].sendText('hello ring')
    for (const node of nodes.slice(1)) {
      expect(node.messages.filter((m) => m.text === 'hello ring')).toHaveLength(1)
    }
    expect(nodes.reduce((s, n) => s + n.stats.duplicates, 0)).toBeGreaterThan(0)
  })

  it('syncs state created while partitioned once a link comes up', async () => {
    const a = meshNode('a', 'A')
    const b = meshNode('b', 'B')
    a.publishAnnotation(annotation(a, 'h1', 'Water leak', { type: 'hazard' }))
    b.publishAnnotation(annotation(b, 's1', 'Need medic', { type: 'sos' }))
    await link(a, b, 'late')
    expect(a.activeAnnotations().map((x) => x.id).sort()).toEqual(['h1', 's1'])
    expect(b.activeAnnotations().map((x) => x.id).sort()).toEqual(['h1', 's1'])
  })

  it('propagates resolutions so closures clear everywhere', async () => {
    const a = meshNode('a', 'A')
    const b = meshNode('b', 'B')
    await link(a, b, 'ab')
    a.publishAnnotation(annotation(a, 'c1', 'Blocked'))
    b.resolveAnnotation('c1')
    expect(a.activeAnnotations()).toHaveLength(0)
  })

  it('eventually converges over a lossy link through periodic sync', async () => {
    const random = seededRandom(3)
    const a = meshNode('a', 'A')
    const b = meshNode('b', 'B')
    const [left, right] = await link(a, b, 'lossy')
    left.withLoss(0.6, random)
    right.withLoss(0.6, random)
    for (let i = 0; i < 10; i++) a.publishAnnotation(annotation(a, `n${i}`, `note ${i}`, { type: 'note' }))
    for (let round = 0; round < 30 && b.activeAnnotations().length < 10; round++) {
      a.sync()
      b.sync()
    }
    expect(b.activeAnnotations()).toHaveLength(10)
  })

  it('shares presence of peers', async () => {
    const a = meshNode('a', 'Alice')
    const b = meshNode('b', 'Bob')
    await link(a, b, 'ab')
    a.updatePresence({ levelId: 'L2', position: [5, 5], accuracy: 2 })
    expect(b.activePeers()[0]).toMatchObject({ name: 'Alice', levelId: 'L2' })
  })

  it('rejects malformed frames', () => {
    const a = meshNode('a', 'A', undefined)
    a.receive('not json')
    a.receive(JSON.stringify({ v: 99 }))
    expect(a.stats.rejected).toBe(2)
  })
})

describe('peer discovery', () => {
  it('is symmetric when a node joins after another is already up', async () => {
    const a = meshNode('a', 'Alice')
    const b = meshNode('b', 'Bob')
    const [left, right] = MemoryTransport.pair('l', 'r')
    a.addTransport(left)
    await left.start() // A's hello goes nowhere: B is not listening yet
    b.addTransport(right)
    await right.start()
    expect(a.activePeers().map((p) => p.name)).toEqual(['Bob'])
    expect(b.activePeers().map((p) => p.name)).toEqual(['Alice'])
  })
})

describe('signed mesh (Ed25519)', () => {
  /** Captures what `a` puts on the wire so a test can tamper with it. */
  async function tap(a: MeshNode) {
    const [wire, far] = MemoryTransport.pair('tap-l', 'tap-r')
    const frames: string[] = []
    far.onFrame = (f) => frames.push(f)
    a.addTransport(wire)
    await far.start()
    await wire.start()
    return frames
  }

  it('rejects a tampered body and still accepts the genuine message afterwards', async () => {
    const a = meshNode('alice')
    const b = meshNode('bob')
    const frames = await tap(a)
    a.sendText('Exit B is clear')
    const genuine = frames.find((f) => f.includes('Exit B is clear'))!
    const forged = genuine.replace('Exit B is clear', 'Exit B is blocked')
    b.receive(forged)
    expect(b.stats.forged).toBe(1)
    expect(b.messages).toHaveLength(0)
    b.receive(genuine)
    expect(b.messages.map((m) => m.text)).toEqual(['Exit B is clear'])
  })

  it('rejects an envelope that claims another peer as its origin', async () => {
    const victim = meshNode('victim')
    const mallory = meshNode('mallory')
    const b = meshNode('bob')
    const frames = await tap(mallory)
    mallory.sendText('evacuate now')
    const envelope = decodeEnvelope(frames.find((f) => f.includes('evacuate'))!)!
    // Re-signed by Mallory, but pretending to come from the victim.
    const spoof = { ...envelope, origin: victim.peerId }
    const sig = signPayload(keyFor('mallory'), signedPart(spoof))
    b.receive(encodeEnvelope({ ...spoof, sig }))
    expect(b.stats.forged).toBe(1)
    expect(b.messages).toHaveLength(0)
  })

  it('rejects unsigned frames', () => {
    const b = meshNode('bob')
    const frame = JSON.stringify({ v: 1, id: 'x', origin: 'y', ttl: 1, hops: 0, hlc: '0000000001:0000:y', body: { kind: 'text', text: 'hi' } })
    b.receive(frame)
    expect(b.stats.rejected).toBe(1)
    expect(b.messages).toHaveLength(0)
  })

  it("refuses a closure published in someone else's name, but lets anyone resolve one", async () => {
    const alice = meshNode('alice')
    const mallory = meshNode('mallory')
    const bob = meshNode('bob')
    await link(alice, bob, 'ab')
    await link(mallory, bob, 'mb')
    mallory.publishAnnotation(annotation(mallory, 'fake', 'Fire on L1', { author: alice.peerId, authorName: 'Alice' }))
    expect(bob.activeAnnotations().map((x) => x.id)).not.toContain('fake')
    expect(bob.stats.forged).toBeGreaterThan(0)

    alice.publishAnnotation(annotation(alice, 'real', 'Corridor blocked'))
    expect(bob.activeAnnotations().map((x) => x.id)).toContain('real')
    mallory.sync()
    mallory.resolveAnnotation('real')
    expect(bob.activeAnnotations().map((x) => x.id)).not.toContain('real')
    expect(bob.writerOf('real')).toBe(mallory.peerId)
  })

  it('keeps the author signature when an entry is relayed by anti-entropy', async () => {
    const a = meshNode('a')
    const b = meshNode('b')
    const c = meshNode('c')
    a.publishAnnotation(annotation(a, 'h1', 'Water leak', { type: 'hazard' }))
    await link(a, b, 'ab') // b learns h1 from a's digest reply
    await link(b, c, 'bc') // c learns it from b, signed by a
    const entry = c.signedEntries().find((e) => e.key === 'h1')!
    expect(entry.pub).toBe(a.publicHex)
    expect(verifiedEntry(entry)).toBe(true)
  })

  it('drops tampered or unsigned entries restored from storage', () => {
    const a = meshNode('a')
    const entry = a.publishAnnotation(annotation(a, 'c1', 'Blocked'))
    const tampered: SignedEntry = { ...entry, value: { ...entry.value, radius: 40 } }
    const unsigned = { key: entry.key, value: entry.value, hlc: entry.hlc }
    const fresh = meshNode('b')
    expect(fresh.restore([tampered, unsigned])).toBe(false)
    expect(fresh.restore([entry])).toBe(true)
  })

  it('derives the peer id from the public key', () => {
    const a = meshNode('a')
    expect(a.peerId).toMatch(/^[0-9a-f]{12}$/)
    expect(meshNode('a').peerId).toBe(a.peerId)
    expect(meshNode('b').peerId).not.toBe(a.peerId)
  })
})
