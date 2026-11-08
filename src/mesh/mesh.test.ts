import { describe, expect, it } from 'vitest'
import { seededRandom } from '../positioning/scanners'
import { LwwMap } from './crdt'
import { HybridLogicalClock, decodeHlc } from './hlc'
import { MeshNode } from './node'
import { ChunkAssembler, chunkFrame, type Annotation } from './protocol'
import { MemoryTransport } from './transports/memory'

function annotation(id: string, text: string, overrides: Partial<Annotation> = {}): Annotation {
  return {
    id, venueId: 'v', type: 'closure', levelId: 'L1', position: [10, 10], radius: 3, text,
    author: 'a', authorName: 'A', createdAt: 0, resolved: false, ...overrides,
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
    const a = new MeshNode({ peerId: 'a', name: 'A', venueId: 'v' })
    const b = new MeshNode({ peerId: 'b', name: 'B', venueId: 'v' })
    const c = new MeshNode({ peerId: 'c', name: 'C', venueId: 'v' })
    await link(a, b, 'ab')
    await link(b, c, 'bc')
    a.publishAnnotation(annotation('closure-1', 'Smoke in corridor'))
    expect(c.activeAnnotations().map((x) => x.text)).toEqual(['Smoke in corridor'])
    expect(b.stats.relayed).toBeGreaterThan(0)
  })

  it('does not loop forever in a ring and drops duplicates', async () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => new MeshNode({ peerId: id, name: id, venueId: 'v' }))
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
    const a = new MeshNode({ peerId: 'a', name: 'A', venueId: 'v' })
    const b = new MeshNode({ peerId: 'b', name: 'B', venueId: 'v' })
    a.publishAnnotation(annotation('h1', 'Water leak', { type: 'hazard' }))
    b.publishAnnotation(annotation('s1', 'Need medic', { type: 'sos' }))
    await link(a, b, 'late')
    expect(a.activeAnnotations().map((x) => x.id).sort()).toEqual(['h1', 's1'])
    expect(b.activeAnnotations().map((x) => x.id).sort()).toEqual(['h1', 's1'])
  })

  it('propagates resolutions so closures clear everywhere', async () => {
    const a = new MeshNode({ peerId: 'a', name: 'A', venueId: 'v' })
    const b = new MeshNode({ peerId: 'b', name: 'B', venueId: 'v' })
    await link(a, b, 'ab')
    a.publishAnnotation(annotation('c1', 'Blocked'))
    b.resolveAnnotation('c1')
    expect(a.activeAnnotations()).toHaveLength(0)
  })

  it('eventually converges over a lossy link through periodic sync', async () => {
    const random = seededRandom(3)
    const a = new MeshNode({ peerId: 'a', name: 'A', venueId: 'v' })
    const b = new MeshNode({ peerId: 'b', name: 'B', venueId: 'v' })
    const [left, right] = await link(a, b, 'lossy')
    left.withLoss(0.6, random)
    right.withLoss(0.6, random)
    for (let i = 0; i < 10; i++) a.publishAnnotation(annotation(`n${i}`, `note ${i}`, { type: 'note' }))
    for (let round = 0; round < 30 && b.activeAnnotations().length < 10; round++) {
      a.sync()
      b.sync()
    }
    expect(b.activeAnnotations()).toHaveLength(10)
  })

  it('shares presence of peers', async () => {
    const a = new MeshNode({ peerId: 'a', name: 'Alice', venueId: 'v' })
    const b = new MeshNode({ peerId: 'b', name: 'Bob', venueId: 'v' })
    await link(a, b, 'ab')
    a.updatePresence({ levelId: 'L2', position: [5, 5], accuracy: 2 })
    expect(b.activePeers()[0]).toMatchObject({ name: 'Alice', levelId: 'L2' })
  })

  it('rejects malformed frames', () => {
    const a = new MeshNode({ peerId: 'a', name: 'A' })
    a.receive('not json')
    a.receive(JSON.stringify({ v: 99 }))
    expect(a.stats.rejected).toBe(2)
  })
})

describe('peer discovery', () => {
  it('is symmetric when a node joins after another is already up', async () => {
    const a = new MeshNode({ peerId: 'a', name: 'Alice', venueId: 'v' })
    const b = new MeshNode({ peerId: 'b', name: 'Bob', venueId: 'v' })
    const [left, right] = MemoryTransport.pair('l', 'r')
    a.addTransport(left)
    await left.start() // A's hello goes nowhere: B is not listening yet
    b.addTransport(right)
    await right.start()
    expect(a.activePeers().map((p) => p.name)).toEqual(['Bob'])
    expect(b.activePeers().map((p) => p.name)).toEqual(['Alice'])
  })
})
