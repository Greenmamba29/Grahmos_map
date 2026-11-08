import { describe, expect, it } from 'vitest'
import { generateKey } from '../identity'
import { MeshNode } from '../node'
import { MemoryTransport } from './memory'
import { RtcLinkManager, type PeerLike } from './webrtc'
import type { RtcSignal } from './rtcPeer'

/** Fake WebRTC pairing: an offer's sdp names the initiator; the answer completes the pair. */
const registry = new Map<string, FakePeer>()
let seq = 0
class FakePeer implements PeerLike {
  private readonly handlers = new Map<string, ((...a: unknown[]) => void)[]>()
  partner: FakePeer | null = null
  readonly id = `fake-${seq++}`
  constructor(initiator: boolean) {
    registry.set(this.id, this)
    if (initiator) queueMicrotask(() => this.emit('signal', { type: 'offer', sdp: this.id }))
  }
  on(event: string, fn: (...a: unknown[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn])
    return this
  }
  emit(event: string, ...args: unknown[]) {
    for (const fn of this.handlers.get(event) ?? []) fn(...args)
  }
  signal(s: RtcSignal) {
    if (s.type === 'offer') {
      this.partner = registry.get(s.sdp!)!
      this.emit('signal', { type: 'answer', sdp: this.id })
    } else if (s.type === 'answer') {
      this.partner = registry.get(s.sdp!)!
      this.emit('connect')
      this.partner.emit('connect')
    }
  }
  send(data: string) {
    this.partner?.emit('data', data)
  }
  private destroyed = false
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.emit('close')
    this.partner?.emit('error', { code: 'ERR_DATA_CHANNEL' })
    this.partner?.emit('close')
  }
}

const node = (n: number, name: string) => new MeshNode({ key: generateKey(new Uint8Array(32).fill(n)), name, venueId: 'v' })
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('RtcLinkManager', () => {
  it('signals over the mesh, then carries messages over the direct link alone', async () => {
    const a = node(1, 'A')
    const b = node(2, 'B')
    const [l, r] = MemoryTransport.pair('sig-l', 'sig-r')
    a.addTransport(l)
    b.addTransport(r)
    await r.start()
    await l.start()
    const ma = new RtcLinkManager(a, (i) => new FakePeer(i))
    new RtcLinkManager(b, (i) => new FakePeer(i))
    ma.connect(b.peerId)
    for (let i = 0; i < 5; i++) await tick()
    const direct = a.links().find((t) => t.id.startsWith('rtc-'))!
    expect(direct.status).toBe('up')
    // Cut the signalling link: the message must travel over the direct link.
    a.removeTransport(l)
    a.sendText('over the direct link')
    expect(b.messages.map((m) => m.text)).toContain('over the direct link')
  })

  it('the higher peer id asks the lower one to initiate (no glare)', async () => {
    const a = node(3, 'A')
    const b = node(4, 'B')
    const [l, r] = MemoryTransport.pair('g-l', 'g-r')
    a.addTransport(l)
    b.addTransport(r)
    await r.start()
    await l.start()
    const [hi, lo] = a.peerId > b.peerId ? [a, b] : [b, a]
    const mh = new RtcLinkManager(hi, (i) => new FakePeer(i))
    new RtcLinkManager(lo, (i) => new FakePeer(i))
    mh.connect(lo.peerId)
    for (let i = 0; i < 6; i++) await tick()
    expect(hi.links().some((t) => t.id.startsWith('rtc-') && t.status === 'up')).toBe(true)
  })

  it('treats the remote leaving (ERR_DATA_CHANNEL quirk) as a normal disconnect, not an error', async () => {
    const a = node(5, 'A')
    const b = node(6, 'B')
    const [l, r] = MemoryTransport.pair('d-l', 'd-r')
    a.addTransport(l)
    b.addTransport(r)
    await r.start()
    await l.start()
    const ma = new RtcLinkManager(a, (i) => new FakePeer(i))
    const mb = new RtcLinkManager(b, (i) => new FakePeer(i))
    ma.connect(b.peerId)
    for (let i = 0; i < 5; i++) await tick()
    const linkOnA = a.links().find((t) => t.id.startsWith('rtc-'))!
    mb.close()
    expect(linkOnA.detail).toBeUndefined()
    expect(a.links().some((t) => t.id.startsWith('rtc-'))).toBe(false)
  })
})
