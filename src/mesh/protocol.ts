import type { Point } from '../indoor/types'
import type { Digest, LwwEntry } from './crdt'

export const MESH_PROTOCOL_VERSION = 1

export type AnnotationType = 'closure' | 'hazard' | 'sos' | 'note' | 'all-clear'

/** Shared, replicated map annotation (hazards, closures, SOS beacons, notes). */
export interface Annotation {
  id: string
  venueId: string
  type: AnnotationType
  levelId: string
  position: Point
  /** Radius in metres for closures/hazards that block routing. */
  radius: number
  text: string
  author: string
  authorName: string
  createdAt: number
  expiresAt?: number
  resolved: boolean
}

export interface PeerPresence {
  peerId: string
  name: string
  venueId?: string
  levelId?: string
  position?: Point
  accuracy?: number
  battery?: number
  at: number
}

export type MeshBody =
  | { kind: 'hello'; name: string; venueId?: string }
  | { kind: 'presence'; presence: PeerPresence }
  | { kind: 'ops'; entries: SignedEntry[] }
  | { kind: 'digest'; venueId: string; digest: Digest; reply?: boolean }
  | { kind: 'venue-offer'; venueId: string; version: number; name: string; bytes: number }
  | { kind: 'venue-request'; venueId: string }
  | { kind: 'venue'; venue: unknown }
  | { kind: 'text'; text: string }

/**
 * A CRDT entry signed by whoever wrote this version. The HLC's node must be the signer's peer id, and a
 * signer other than the annotation's author may only publish a resolution (resolved: true).
 */
export interface SignedEntry extends LwwEntry<Annotation> {
  /** Ed25519 public key of the writer, hex. */
  pub: string
  /** Signature over canonical({ key, value, hlc }), hex. */
  sig: string
}

export interface MeshEnvelope {
  v: number
  id: string
  /** Peer id = first 12 hex of SHA-256(pub); checked on receipt. */
  origin: string
  /** Remaining relay hops (not signed: relays decrement it). */
  ttl: number
  /** Hops travelled (not signed: relays increment it). */
  hops: number
  hlc: string
  body: MeshBody
  /** Sender's Ed25519 public key, hex. */
  pub: string
  /** Signature over canonical({ v, id, origin, hlc, body, pub }), hex. */
  sig: string
}

/** The envelope fields covered by the sender's signature. */
export function signedPart(e: Omit<MeshEnvelope, 'sig'> | MeshEnvelope) {
  return { v: e.v, id: e.id, origin: e.origin, hlc: e.hlc, body: e.body, pub: e.pub }
}

export function randomId(bytes = 8) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return [...data].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function encodeEnvelope(envelope: MeshEnvelope): string {
  return JSON.stringify(envelope)
}

export function decodeEnvelope(frame: string): MeshEnvelope | null {
  try {
    const value = JSON.parse(frame) as MeshEnvelope
    if (
      value?.v !== MESH_PROTOCOL_VERSION ||
      typeof value.id !== 'string' ||
      typeof value.origin !== 'string' ||
      typeof value.ttl !== 'number' ||
      typeof value.hlc !== 'string' ||
      typeof value.pub !== 'string' ||
      typeof value.sig !== 'string' ||
      typeof value.body?.kind !== 'string'
    ) {
      return null
    }
    return value
  } catch {
    return null
  }
}

/**
 * Splits frames into small packets for constrained links (BLE GATT writes,
 * LoRa relays). Header: u16 message seq · u16 chunk index · u16 chunk count.
 */
export const CHUNK_HEADER_BYTES = 6

export function chunkFrame(frame: string, seq: number, maxPacketBytes = 180): Uint8Array<ArrayBuffer>[] {
  const payload = new TextEncoder().encode(frame)
  const room = Math.max(1, maxPacketBytes - CHUNK_HEADER_BYTES)
  const total = Math.max(1, Math.ceil(payload.length / room))
  if (total > 0xffff) throw new Error('Frame too large for chunked transport')
  const packets: Uint8Array<ArrayBuffer>[] = []
  for (let i = 0; i < total; i++) {
    const body = payload.subarray(i * room, (i + 1) * room)
    const packet = new Uint8Array(CHUNK_HEADER_BYTES + body.length)
    const view = new DataView(packet.buffer)
    view.setUint16(0, seq & 0xffff)
    view.setUint16(2, i)
    view.setUint16(4, total)
    packet.set(body, CHUNK_HEADER_BYTES)
    packets.push(packet)
  }
  return packets
}

/** Reassembles chunked packets; tolerates interleaving and drops stale partials. */
export class ChunkAssembler {
  private readonly partial = new Map<number, { parts: (Uint8Array | undefined)[]; received: number; at: number }>()

  constructor(private readonly timeoutMs = 15_000) {}

  push(packet: Uint8Array, now = Date.now()): string | null {
    if (packet.byteLength < CHUNK_HEADER_BYTES) return null
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
    const seq = view.getUint16(0)
    const index = view.getUint16(2)
    const total = view.getUint16(4)
    if (total === 0 || index >= total) return null

    for (const [key, value] of this.partial) if (now - value.at > this.timeoutMs) this.partial.delete(key)

    let entry = this.partial.get(seq)
    if (!entry || entry.parts.length !== total) {
      entry = { parts: new Array(total), received: 0, at: now }
      this.partial.set(seq, entry)
    }
    if (!entry.parts[index]) {
      entry.parts[index] = packet.slice(CHUNK_HEADER_BYTES)
      entry.received++
    }
    entry.at = now
    if (entry.received < total) return null
    this.partial.delete(seq)
    const size = entry.parts.reduce((s, p) => s + (p?.byteLength ?? 0), 0)
    const out = new Uint8Array(size)
    let offset = 0
    for (const part of entry.parts) {
      out.set(part!, offset)
      offset += part!.byteLength
    }
    return new TextDecoder().decode(out)
  }
}
