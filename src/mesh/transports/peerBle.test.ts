import { describe, expect, it } from 'vitest'
import { createDemoVenue } from '../../indoor/demoVenue'
import { generateKey } from '../identity'
import { MeshNode } from '../node'
import { PeerBleTransport, type BleMeshRadio } from './peerBle'

/** Fake air: every phone that started hears every packet sent by the others, like a BLE mesh in range. */
function air() {
  const phones = new Map<string, { packet: ((e: { data: string; from: string }) => void)[]; peers: ((e: { links: number }) => void)[] }>()
  let n = 0
  const radio = (): BleMeshRadio => {
    const id = `phone-${n++}`
    const handlers = { packet: [] as ((e: { data: string; from: string }) => void)[], peers: [] as ((e: { links: number }) => void)[] }
    return {
      start: async () => {
        phones.set(id, handlers)
        for (const [, h] of phones) for (const fn of h.peers) fn({ links: phones.size - 1 })
      },
      stop: async () => void phones.delete(id),
      send: async ({ data }) => {
        for (const [other, h] of phones) if (other !== id) for (const fn of h.packet) fn({ data, from: id })
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addListener: (async (event: 'packet' | 'peers', fn: any) => {
        handlers[event].push(fn)
        return { remove: async () => void handlers[event].splice(handlers[event].indexOf(fn), 1) }
      }) as BleMeshRadio['addListener'],
    }
  }
  return { radio }
}

const node = (n: number, name: string) => new MeshNode({ key: generateKey(new Uint8Array(32).fill(n)), name, venueId: 'grahmos-civic-center' })
const settle = () => new Promise((r) => setTimeout(r, 10))

describe('PeerBleTransport (relay-free phone-to-phone mesh)', () => {
  it('links phones without relay hardware and delivers signed messages', async () => {
    const sky = air()
    const a = node(11, 'Ana')
    const b = node(12, 'Ben')
    const ta = new PeerBleTransport(sky.radio())
    const tb = new PeerBleTransport(sky.radio())
    a.addTransport(ta)
    b.addTransport(tb)
    await ta.start()
    await tb.start()
    await settle()
    expect(ta.status).toBe('up')
    a.sendText('Exit B is clear')
    await settle()
    expect(b.messages.map((m) => m.text)).toContain('Exit B is clear')
    expect(b.activePeers().map((p) => p.name)).toContain('Ana')
  })

  it('shares a whole venue map phone to phone in bitchat fragments', async () => {
    const sky = air()
    const a = node(13, 'Ana')
    const b = node(14, 'Ben')
    let received: unknown = null
    b.setVenueHandler((v) => (received = v))
    const ta = new PeerBleTransport(sky.radio())
    const tb = new PeerBleTransport(sky.radio())
    a.addTransport(ta)
    b.addTransport(tb)
    await ta.start()
    await tb.start()
    await settle()
    a.shareVenue(createDemoVenue())
    await settle()
    expect((received as { id: string } | null)?.id).toBe('grahmos-civic-center')
  })

  it('reports permission or radio failures as a link error', async () => {
    const failing: BleMeshRadio = { ...air().radio(), start: async () => Promise.reject(new Error('Bluetooth permission denied')) }
    const t = new PeerBleTransport(failing)
    await expect(t.start()).rejects.toThrow('permission')
    expect(t.status).toBe('error')
  })
})
