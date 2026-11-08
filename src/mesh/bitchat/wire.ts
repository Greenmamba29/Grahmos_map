/**
 * Port of bitchat's BLE wire format (BitFoundation/BinaryProtocol.swift, MessagePadding.swift,
 * CompressionUtil.swift, PacketPayloadLimits.swift, BitchatPacket.swift) at
 * third_party/bitchat @ 04995f6 (Unlicense). Behaviour, quirks included, is proven against the golden
 * recorded from the unmodified Swift code (rea/bitchat/golden.json). Do not "fix" anything in this file:
 * GrahmOS-specific behaviour lives in ../bitchatTransport.ts and is justified by named tests.
 */
import { deflateSync, inflateSync } from 'fflate'
import { sha256 } from '@noble/hashes/sha2.js'

export interface BitchatPacket {
  version: number
  type: number
  senderID: Uint8Array
  recipientID: Uint8Array | null
  /** Milliseconds; UInt64 on the wire. */
  timestamp: bigint
  payload: Uint8Array
  signature: Uint8Array | null
  ttl: number
  route: Uint8Array[] | null
  isRSR: boolean
}

export const MessageType = {
  announce: 0x01,
  message: 0x02,
  leave: 0x03,
  courierEnvelope: 0x04,
  noiseHandshake: 0x10,
  noiseEncrypted: 0x11,
  fragment: 0x20,
  requestSync: 0x21,
  fileTransfer: 0x22,
  boardPost: 0x23,
  prekeyBundle: 0x24,
  groupMessage: 0x25,
  ping: 0x26,
  pong: 0x27,
  nostrCarrier: 0x28,
  voiceFrame: 0x29,
  announceV2: 0x2c,
} as const

export const V1_HEADER = 14
export const V2_HEADER = 16
export const SENDER_ID_SIZE = 8
export const RECIPIENT_ID_SIZE = 8
export const SIGNATURE_SIZE = 64
export const Flags = { hasRecipient: 0x01, hasSignature: 0x02, isCompressed: 0x04, hasRoute: 0x08, isRSR: 0x10 } as const

export function headerSize(version: number): number | null {
  return version === 1 ? V1_HEADER : version === 2 ? V2_HEADER : null
}
const lengthFieldSize = (version: number) => (version === 2 ? 4 : 2)

// ---- limits (PacketPayloadLimits / FileTransferLimits)
export const MAX_DEFLATE_RATIO = 1032
const FRAGMENT_BYTES = 1_280
const CONTROL_BYTES = 4 * 1024
const REQUEST_SYNC_BYTES = 8 * 1024
const ENVELOPE_BYTES = 64 * 1024
const TWICE_V1_FRAME_BYTES = 128 * 1024
export const MAX_FRAMED_FILE_BYTES = 1024 * 1024 + (18 + 0xffff * 2) + (V2_HEADER + SENDER_ID_SIZE + RECIPIENT_ID_SIZE + SIGNATURE_SIZE)
const MAX_FRAME_OVERHEAD = V2_HEADER + SENDER_ID_SIZE + RECIPIENT_ID_SIZE + 1 + 255 * SENDER_ID_SIZE + 4 + SIGNATURE_SIZE + 255
const KNOWN_TYPES = new Set<number>(Object.values(MessageType))

export function maxPayloadBytes(type: number): number {
  if (!KNOWN_TYPES.has(type)) return TWICE_V1_FRAME_BYTES
  switch (type) {
    case MessageType.fileTransfer:
    case MessageType.noiseEncrypted:
      return MAX_FRAMED_FILE_BYTES
    case MessageType.message:
    case MessageType.groupMessage:
      return TWICE_V1_FRAME_BYTES
    case MessageType.courierEnvelope:
    case MessageType.nostrCarrier:
      return ENVELOPE_BYTES
    case MessageType.requestSync:
      return REQUEST_SYNC_BYTES
    case MessageType.fragment:
      return FRAGMENT_BYTES
    default:
      return CONTROL_BYTES
  }
}

export function maxFrameBytes(type: number) {
  return maxPayloadBytes(type) + MAX_FRAME_OVERHEAD
}

// ---- padding (MessagePadding: PKCS#7-style, blocks 256/512/1024/2048, pad ≤ 255)
const BLOCK_SIZES = [256, 512, 1024, 2048]

export function optimalBlockSize(dataSize: number) {
  const total = dataSize + 16
  for (const block of BLOCK_SIZES) if (total <= block) return block
  return dataSize
}

export function pad(data: Uint8Array, targetSize: number): Uint8Array {
  if (data.length >= targetSize) return data
  const needed = targetSize - data.length
  if (needed <= 0 || needed > 255) return data
  const out = new Uint8Array(targetSize)
  out.set(data)
  out.fill(needed, data.length)
  return out
}

/** Returns the SAME array instance when there is no valid padding (decode relies on that identity). */
export function unpad(data: Uint8Array): Uint8Array {
  if (!data.length) return data
  const last = data[data.length - 1]
  if (last <= 0 || last > data.length) return data
  for (let i = data.length - last; i < data.length; i++) if (data[i] !== last) return data
  return data.subarray(0, data.length - last)
}

// ---- compression (CompressionUtil: raw DEFLATE, threshold 100 bytes, skip high-entropy payloads)
export interface Compressor {
  /** Raw DEFLATE (no zlib header), or null if it doesn't fit `capacity`. */
  deflateRaw(data: Uint8Array, capacity: number): Uint8Array | null
  inflateRaw(data: Uint8Array, originalSize: number): Uint8Array | null
}

/** Browser/native default (fflate, MIT). Valid raw DEFLATE; not byte-identical to Apple's encoder. */
export const fflateCompressor: Compressor = {
  deflateRaw(data, capacity) {
    const out = deflateSync(data, { level: 5 })
    return out.length > capacity ? null : out
  },
  inflateRaw(data, originalSize) {
    try {
      const out = inflateSync(data, { out: new Uint8Array(originalSize) })
      return out.length ? out : null
    } catch {
      return null
    }
  },
}

export const COMPRESSION_THRESHOLD = 100

export function shouldCompress(data: Uint8Array) {
  if (data.length < COMPRESSION_THRESHOLD) return false
  const unique = new Set(data).size
  const sample = Math.min(data.length, 256)
  return unique / sample < 0.9
}

function compress(data: Uint8Array, c: Compressor): Uint8Array | null {
  if (data.length < COMPRESSION_THRESHOLD) return null
  const capacity = data.length + Math.floor(data.length / 255) + 16
  const out = c.deflateRaw(data, capacity)
  if (!out || out.length === 0 || out.length >= data.length) return null
  return out
}

// ---- encode / decode
function fixed(bytes: Uint8Array, size: number) {
  const out = new Uint8Array(size)
  out.set(bytes.subarray(0, size))
  return out
}

export function encode(packet: BitchatPacket, padding = true, c: Compressor = fflateCompressor): Uint8Array | null {
  const version = packet.version
  if (version !== 1 && version !== 2) return null

  let payload = packet.payload
  let isCompressed = false
  let originalSize: number | null = null
  if (shouldCompress(payload)) {
    const maxRepresentable = version === 2 ? 0xffffffff : 0xffff
    if (payload.length <= maxRepresentable) {
      const compressed = compress(payload, c)
      if (compressed) {
        originalSize = payload.length
        payload = compressed
        isCompressed = true
      }
    }
  }
  const lengthBytes = lengthFieldSize(version)
  const originalRoute = version >= 2 ? (packet.route ?? []) : []
  if (originalRoute.some((hop) => hop.length === 0)) return null
  const route = originalRoute.map((hop) => fixed(hop, SENDER_ID_SIZE))
  if (route.length > 255) return null
  const hasRoute = route.length > 0
  const payloadDataSize = payload.length + (isCompressed ? lengthBytes : 0)
  if (version === 1 && payloadDataSize > 0xffff) return null
  if (version === 2 && payloadDataSize > 0xffffffff) return null

  const parts: number[] = [version, packet.type & 0xff, packet.ttl & 0xff]
  for (let shift = 56n; shift >= 0n; shift -= 8n) parts.push(Number((packet.timestamp >> shift) & 0xffn))
  let flags = 0
  if (packet.recipientID) flags |= Flags.hasRecipient
  if (packet.signature) flags |= Flags.hasSignature
  if (isCompressed) flags |= Flags.isCompressed
  if (hasRoute && version >= 2) flags |= Flags.hasRoute
  if (packet.isRSR) flags |= Flags.isRSR
  parts.push(flags)
  pushLength(parts, payloadDataSize, version)

  const chunks: Uint8Array[] = [Uint8Array.from(parts), fixed(packet.senderID, SENDER_ID_SIZE)]
  if (packet.recipientID) chunks.push(fixed(packet.recipientID, RECIPIENT_ID_SIZE))
  if (hasRoute) chunks.push(Uint8Array.of(route.length), ...route)
  if (isCompressed && originalSize !== null) {
    const len: number[] = []
    pushLength(len, originalSize, version)
    chunks.push(Uint8Array.from(len))
  }
  chunks.push(payload)
  if (packet.signature) chunks.push(packet.signature.subarray(0, SIGNATURE_SIZE))
  const data = concat(chunks)
  return padding ? pad(data, optimalBlockSize(data.length)) : data
}

function pushLength(out: number[], value: number, version: number) {
  if (version === 2) out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff)
  else out.push((value >>> 8) & 0xff, value & 0xff)
}

export function concat(chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export function decode(data: Uint8Array, c: Compressor = fflateCompressor): BitchatPacket | null {
  const packet = decodeCore(data, c)
  if (packet) return packet
  const unpadded = unpad(data)
  if (unpadded === data) return null
  return decodeCore(unpadded, c)
}

function decodeCore(raw: Uint8Array, c: Compressor): BitchatPacket | null {
  if (raw.length < V1_HEADER + SENDER_ID_SIZE) return null
  let offset = 0
  const need = (n: number) => offset + n <= raw.length
  const read8 = () => (need(1) ? raw[offset++] : null)
  const read16 = () => {
    if (!need(2)) return null
    const v = (raw[offset] << 8) | raw[offset + 1]
    offset += 2
    return v
  }
  const read32 = () => {
    if (!need(4)) return null
    const v = ((raw[offset] << 24) >>> 0) + (raw[offset + 1] << 16) + (raw[offset + 2] << 8) + raw[offset + 3]
    offset += 4
    return v
  }
  const readData = (n: number) => {
    if (!need(n)) return null
    const v = raw.slice(offset, offset + n)
    offset += n
    return v
  }

  const version = read8()
  if (version !== 1 && version !== 2) return null
  const lengthBytes = lengthFieldSize(version)
  const hSize = headerSize(version)!
  if (raw.length < hSize + SENDER_ID_SIZE) return null
  const type = read8()
  const ttl = read8()
  if (type === null || ttl === null) return null
  let timestamp = 0n
  for (let i = 0; i < 8; i++) {
    const b = read8()
    if (b === null) return null
    timestamp = (timestamp << 8n) | BigInt(b)
  }
  const flags = read8()
  if (flags === null) return null
  const hasRecipient = (flags & Flags.hasRecipient) !== 0
  const hasSignature = (flags & Flags.hasSignature) !== 0
  const isCompressed = (flags & Flags.isCompressed) !== 0
  const hasRoute = version >= 2 && (flags & Flags.hasRoute) !== 0
  const isRSR = (flags & Flags.isRSR) !== 0
  const payloadLength = version === 2 ? read32() : read16()
  if (payloadLength === null || payloadLength < 0 || payloadLength > MAX_FRAMED_FILE_BYTES) return null
  const senderID = readData(SENDER_ID_SIZE)
  if (!senderID) return null
  let recipientID: Uint8Array | null = null
  if (hasRecipient) {
    recipientID = readData(RECIPIENT_ID_SIZE)
    if (!recipientID) return null
  }
  let route: Uint8Array[] | null = null
  if (hasRoute) {
    const count = read8()
    if (count === null) return null
    if (count > 0) {
      route = []
      for (let i = 0; i < count; i++) {
        const hop = readData(SENDER_ID_SIZE)
        if (!hop) return null
        route.push(hop)
      }
    }
  }
  const maxPayload = maxPayloadBytes(type)
  let payload: Uint8Array
  if (isCompressed) {
    if (payloadLength < lengthBytes) return null
    const originalSize = version === 2 ? read32() : read16()
    if (originalSize === null || originalSize < 0 || originalSize > maxPayload) return null
    const compressedSize = payloadLength - lengthBytes
    if (compressedSize <= 0) return null
    const compressed = readData(compressedSize)
    if (!compressed) return null
    if (originalSize > compressedSize * MAX_DEFLATE_RATIO) return null
    const out = c.inflateRaw(compressed, originalSize)
    if (!out || out.length !== originalSize) return null
    payload = out
  } else {
    if (payloadLength > maxPayload) return null
    const p = readData(payloadLength)
    if (!p) return null
    payload = p
  }
  let signature: Uint8Array | null = null
  if (hasSignature) {
    signature = readData(SIGNATURE_SIZE)
    if (!signature) return null
  }
  // Upstream quirk (kept): bytes after the signature are ignored, not rejected.
  return { version, type, senderID, recipientID, timestamp, payload, signature, ttl, route, isRSR }
}

/** Bytes a sender signs: TTL 0, no signature, RSR cleared, and (upstream quirk) padded by default. */
export function signingBytes(packet: BitchatPacket, c: Compressor = fflateCompressor) {
  return encode({ ...packet, signature: null, ttl: 0, isRSR: false }, true, c)
}

/** Gossip/dedup id: first 16 bytes of SHA-256(type | senderID | timestamp BE | payload). */
export function packetId(packet: BitchatPacket): Uint8Array {
  const ts = new Uint8Array(8)
  new DataView(ts.buffer).setBigUint64(0, packet.timestamp)
  return sha256(concat([Uint8Array.of(packet.type & 0xff), packet.senderID, ts, packet.payload])).slice(0, 16)
}
