/**
 * Port of bitchat's BLE fragmentation (BLEOutboundFragmentPlanner.swift, BLEFragmentAssemblyBuffer.swift @
 * 04995f6, Unlicense). Fragment payload: id(8) | index u16 | total u16 | original type | data.
 * Parity-proven against the golden recorded from the unmodified Swift code.
 */
import { MessageType, encode, maxFrameBytes, type BitchatPacket, type Compressor, fflateCompressor } from './wire.ts'

export const MIN_CHUNK = 64
export const FRAGMENT_ID_LENGTH = 8
export const SPACING_MS = 30
export const SPACING_DIRECTED_MS = 25

export interface FragmentRequest {
  packet: BitchatPacket
  pad: boolean
  maxChunk?: number | null
  /** Directed peer id as hex; becomes the fragments' recipient. */
  directedPeer?: string | null
}

export interface FragmentPlan {
  fragments: BitchatPacket[]
  fragmentVersion: number
  chunkSize: number
  spacingMs: number
}

function hexToBytes(hex: string): Uint8Array | null {
  let h = hex.trim()
  if (h.startsWith('0x') || h.startsWith('0X')) h = h.slice(2)
  if (h.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(h)) return null
  return Uint8Array.from(h.match(/../g) ?? [], (b) => parseInt(b, 16))
}

export function makePlan(
  request: FragmentRequest,
  defaultChunkSize: number,
  bleMaxMTU: number,
  fragmentID: Uint8Array = crypto.getRandomValues(new Uint8Array(FRAGMENT_ID_LENGTH)),
  c: Compressor = fflateCompressor,
): FragmentPlan | null {
  if (fragmentID.length !== FRAGMENT_ID_LENGTH) return null
  const full = encode(request.packet, request.pad, c)
  if (!full) return null
  let fragmentVersion = 1
  let calculated = defaultChunkSize
  const route = request.packet.route
  if (route && route.length) {
    fragmentVersion = 2
    const routeSize = 1 + route.length * 8
    const overhead = 16 + 8 + 8 + routeSize + 13 + 16
    calculated = Math.max(MIN_CHUNK, bleMaxMTU - overhead)
  }
  const chunkSize = Math.max(MIN_CHUNK, request.maxChunk ?? calculated)
  const chunks: Uint8Array[] = []
  for (let offset = 0; offset < full.length; offset += chunkSize) chunks.push(full.slice(offset, Math.min(offset + chunkSize, full.length)))
  if (!chunks.length) return null
  const recipient = request.directedPeer ? hexToBytes(request.directedPeer) : request.packet.recipientID
  const fragments = chunks.map((chunk, index) => {
    const payload = new Uint8Array(13 + chunk.length)
    payload.set(fragmentID, 0)
    new DataView(payload.buffer).setUint16(8, index)
    new DataView(payload.buffer).setUint16(10, chunks.length)
    payload[12] = request.packet.type
    payload.set(chunk, 13)
    return {
      type: MessageType.fragment,
      senderID: request.packet.senderID,
      recipientID: recipient,
      timestamp: request.packet.timestamp,
      payload,
      signature: null,
      ttl: request.packet.ttl,
      version: fragmentVersion,
      route: request.packet.route,
      isRSR: request.packet.isRSR,
    } satisfies BitchatPacket
  })
  const directed = Boolean(request.directedPeer) || request.packet.recipientID !== null
  return { fragments, fragmentVersion, chunkSize, spacingMs: directed ? SPACING_DIRECTED_MS : SPACING_MS }
}

export interface FragmentHeader {
  key: string
  index: number
  total: number
  originalType: number
  data: Uint8Array
  isBroadcast: boolean
}

export function parseFragment(packet: BitchatPacket): FragmentHeader | null {
  const p = packet.payload
  if (p.length < 13) return null
  let sender = 0n
  for (const b of packet.senderID.subarray(0, 8)) sender = (sender << 8n) | BigInt(b)
  let id = 0n
  for (const b of p.subarray(0, 8)) id = (id << 8n) | BigInt(b)
  const index = (p[8] << 8) | p[9]
  const total = (p[10] << 8) | p[11]
  if (!(total > 0 && total <= 10_000 && index >= 0 && index < total)) return null
  const r = packet.recipientID
  const isBroadcast = !r || (r.length === 8 && r.every((b) => b === 0xff))
  return { key: `${sender}:${id}`, index, total, originalType: p[12], data: p.slice(13), isBroadcast }
}

export type AppendResult =
  | { result: 'stored'; started: boolean }
  | { result: 'complete'; started: boolean; originalType: number; data: Uint8Array }
  | { result: 'oversized'; started: boolean; projectedSize: number; limit: number }

/** Reassembles fragment streams; a re-delivered index replaces (not adds to) what it held. */
export class FragmentAssemblyBuffer {
  private readonly fragments = new Map<string, Map<number, Uint8Array>>()
  private readonly meta = new Map<string, { total: number; timestamp: number; isBroadcast: boolean; lastFragmentAt: number }>()

  removeExpired(cutoff: number) {
    let n = 0
    for (const [key, m] of this.meta) {
      if (m.timestamp < cutoff) {
        this.fragments.delete(key)
        this.meta.delete(key)
        n++
      }
    }
    return n
  }

  append(header: FragmentHeader, maxInFlight: number, now = Date.now()): AppendResult {
    let started = false
    if (!this.fragments.has(header.key)) {
      if (this.fragments.size >= maxInFlight) {
        let oldest: string | null = null
        let at = Infinity
        for (const [key, m] of this.meta) {
          if (m.timestamp < at) {
            at = m.timestamp
            oldest = key
          }
        }
        if (oldest !== null) {
          this.fragments.delete(oldest)
          this.meta.delete(oldest)
        }
      }
      this.fragments.set(header.key, new Map())
      this.meta.set(header.key, { total: header.total, timestamp: now, isBroadcast: header.isBroadcast, lastFragmentAt: now })
      started = true
    }
    const held = this.fragments.get(header.key)!
    let current = 0
    for (const v of held.values()) current += v.length
    const limit = maxFrameBytes(header.originalType)
    const projectedSize = current - (held.get(header.index)?.length ?? 0) + header.data.length
    if (projectedSize > limit) {
      this.fragments.delete(header.key)
      this.meta.delete(header.key)
      return { result: 'oversized', started, projectedSize, limit }
    }
    if (!held.has(header.index)) this.meta.get(header.key)!.lastFragmentAt = now
    held.set(header.index, header.data)
    if (held.size !== header.total) return { result: 'stored', started }
    const parts: Uint8Array[] = []
    let size = 0
    for (let i = 0; i < header.total; i++) {
      const f = held.get(i)
      if (f) {
        parts.push(f)
        size += f.length
      }
    }
    const data = new Uint8Array(size)
    let o = 0
    for (const f of parts) {
      data.set(f, o)
      o += f.length
    }
    this.fragments.delete(header.key)
    this.meta.delete(header.key)
    return { result: 'complete', started, originalType: header.originalType, data }
  }
}
