import { describe, expect, it } from 'vitest'
import { generateKey } from '../identity'
import { MeshNode } from '../node'
import { NativeBluetoothRelayTransport, type NativeBleCentral } from './nativeRelay'

/**
 * A fake relay board: every packet one phone writes is notified, byte for byte, to every other connected
 * phone — exactly what the ESP32 Nordic UART relay firmware does.
 */
function relayBoard(mtu: number) {
  const phones = new Map<string, (v: DataView) => void>()
  const written: number[] = []
  let n = 0
  const phone = (): NativeBleCentral => {
    const me = `phone-${n++}`
    return {
      initialize: async () => {},
      requestDevice: async () => ({ deviceId: 'relay-1', name: 'GrahmOS Relay' }),
      connect: async () => {},
      disconnect: async () => void phones.delete(me),
      getMtu: async () => mtu,
      startNotifications: async (_d, _s, _c, cb) => void phones.set(me, cb),
      writeWithoutResponse: async (_d, _s, _c, value) => {
        written.push(value.byteLength)
        const copy = new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
        for (const [id, notify] of phones) if (id !== me) notify(copy)
      },
    }
  }
  return { phone, written }
}

const settle = () => new Promise((r) => setTimeout(r, 20))

describe('NativeBluetoothRelayTransport', () => {
  it('carries signed mesh messages between two phones through a relay, chunked to the MTU', async () => {
    const board = relayBoard(185)
    const alice = new MeshNode({ key: generateKey(new Uint8Array(32).fill(1)), name: 'Alice', venueId: 'v' })
    const bob = new MeshNode({ key: generateKey(new Uint8Array(32).fill(2)), name: 'Bob', venueId: 'v' })
    const ta = new NativeBluetoothRelayTransport(board.phone())
    const tb = new NativeBluetoothRelayTransport(board.phone())
    alice.addTransport(ta)
    bob.addTransport(tb)
    await ta.start()
    await tb.start()
    await settle()
    alice.sendText('Stairwell B is smoke-free')
    await settle()
    expect(bob.messages.map((m) => m.text)).toContain('Stairwell B is smoke-free')
    expect(bob.activePeers().map((p) => p.name)).toContain('Alice')
    // ATT payload = MTU − 3: no packet may exceed 182 bytes.
    expect(Math.max(...board.written)).toBeLessThanOrEqual(182)
    expect(board.written.length).toBeGreaterThan(2)
  })

  it('falls back to 20-byte packets when the stack reports a tiny MTU', async () => {
    const board = relayBoard(23)
    const a = new MeshNode({ key: generateKey(new Uint8Array(32).fill(3)), name: 'A', venueId: 'v' })
    const t = new NativeBluetoothRelayTransport(board.phone())
    a.addTransport(t)
    await t.start()
    await settle()
    expect(Math.max(...board.written)).toBeLessThanOrEqual(20)
  })
})
