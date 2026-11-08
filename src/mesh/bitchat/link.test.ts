import { describe, expect, it } from 'vitest'
import { createDemoVenue } from '../../indoor/demoVenue'
import { BitchatLinkCodec, GRAHMOS_ENVELOPE } from './link'
import { decode, MessageType } from './wire'

describe('BitchatLinkCodec (GrahmOS envelopes in bitchat packets)', () => {
  it('sends a small envelope as one compressed packet', () => {
    const codec = new BitchatLinkCodec(512)
    const frame = JSON.stringify({ v: 1, body: { kind: 'text', text: 'hello '.repeat(30) } })
    const packets = codec.encode(frame)
    expect(packets).toHaveLength(1)
    expect(packets[0].length).toBeLessThan(frame.length)
    expect(decode(packets[0])!.type).toBe(GRAHMOS_ENVELOPE)
    expect(new BitchatLinkCodec().push(packets[0])).toBe(frame)
  })

  it('fragments a whole venue map to the packet budget and reassembles it in any order', () => {
    const tx = new BitchatLinkCodec(180)
    const rx = new BitchatLinkCodec(180)
    const frame = JSON.stringify({ v: 1, body: { kind: 'venue', venue: createDemoVenue() } })
    const packets = tx.encode(frame)
    expect(packets.length).toBeGreaterThan(5)
    expect(Math.max(...packets.map((p) => p.length))).toBeLessThanOrEqual(180)
    expect(packets.every((p) => decode(p)!.type === MessageType.fragment)).toBe(true)
    const shuffled = [...packets].reverse()
    let out: string | null = null
    for (const p of shuffled) out = rx.push(p) ?? out
    expect(out).toBe(frame)
    // Compression: far fewer bytes on air than the JSON itself.
    expect(packets.reduce((s, p) => s + p.length, 0)).toBeLessThan(frame.length / 2)
  })

  it('ignores bitchat traffic that is not a GrahmOS envelope', () => {
    const codec = new BitchatLinkCodec()
    const other = new Uint8Array([1, 2, 7, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1, 2, 3, 4, 5, 6, 7, 8, 104, 105])
    expect(codec.push(other)).toBeNull()
    expect(codec.push(new Uint8Array([0xff]))).toBeNull()
  })
})
