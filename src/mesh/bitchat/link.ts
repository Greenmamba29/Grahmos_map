/**
 * GrahmOS envelopes over bitchat's BLE framing (ported in ./wire.ts, ./fragments.ts, proven against the
 * golden from unmodified bitchat). Each signed JSON envelope rides in one bitchat packet of a private type,
 * DEFLATE-compressed when it helps (JSON typically shrinks 3–5×), and is split into bitchat fragment packets
 * when it exceeds the link's packet budget. Relays forward packets byte for byte.
 */
import { decode, encode, maxPayloadBytes, MessageType, type BitchatPacket } from './wire'
import { FragmentAssemblyBuffer, makePlan, parseFragment } from './fragments'

/** Private packet type for a GrahmOS mesh envelope (unused by bitchat's MessageType table). */
export const GRAHMOS_ENVELOPE = 0x40
const MAX_IN_FLIGHT = 32
const FRAGMENT_OVERHEAD = 14 + 8 + 13 // v1 header + sender + fragment header

export class BitchatLinkCodec {
  private readonly sender: Uint8Array
  private readonly assembly = new FragmentAssemblyBuffer()

  /** `packetBytes`: largest packet the link carries (BLE: negotiated MTU − 3; long writes allow 512). */
  constructor(private readonly packetBytes = 180) {
    this.sender = crypto.getRandomValues(new Uint8Array(8))
  }

  /** Envelope frame (JSON text) → one or more bitchat packets ready to write. */
  encode(frame: string): Uint8Array[] {
    const packet: BitchatPacket = {
      version: 1,
      type: GRAHMOS_ENVELOPE,
      senderID: this.sender,
      recipientID: null,
      timestamp: BigInt(Date.now()),
      payload: new TextEncoder().encode(frame),
      signature: null,
      ttl: 0,
      route: null,
      isRSR: false,
    }
    // Receivers cap an unknown type's decoded payload at 128 KiB (wire.maxPayloadBytes); refuse rather than
    // send something no bitchat-framed peer will accept.
    if (packet.payload.length > maxPayloadBytes(GRAHMOS_ENVELOPE)) throw new Error('frame exceeds 128 KiB mesh limit')
    const whole = encode(packet, false)
    if (!whole) throw new Error('frame too large for a bitchat packet')
    if (whole.length <= this.packetBytes) return [whole]
    const plan = makePlan({ packet, pad: false }, Math.max(64, this.packetBytes - FRAGMENT_OVERHEAD), 512)
    if (!plan) throw new Error('could not fragment frame')
    return plan.fragments.map((f) => encode(f, false)!)
  }

  /** One received packet → the envelope frame it completes, or null (fragment stored, or not ours). */
  push(bytes: Uint8Array, now = Date.now()): string | null {
    const packet = decode(bytes)
    if (!packet) return null
    if (packet.type === MessageType.fragment) {
      const header = parseFragment(packet)
      if (!header || header.originalType !== GRAHMOS_ENVELOPE) return null
      this.assembly.removeExpired(now - 30_000)
      const r = this.assembly.append(header, MAX_IN_FLIGHT, now)
      if (r.result !== 'complete') return null
      return this.push(r.data, now)
    }
    if (packet.type !== GRAHMOS_ENVELOPE) return null
    return new TextDecoder().decode(packet.payload)
  }
}
