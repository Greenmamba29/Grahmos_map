// Parity port: same stdin/stdout protocol as the Swift reference runner, driving src/mesh/bitchat.
// Compression uses Node's zlib (raw DEFLATE, level 5) so the FRAMING is compared byte for byte with Apple's
// zlib encoder; the product uses fflate, whose different-but-valid DEFLATE is covered by interop tests.
// `--mutant` flips one deliberate bug (negative control).
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { decode, encode, packetId, signingBytes, type BitchatPacket, type Compressor } from '../../src/mesh/bitchat/wire.ts'
import { buildFilter, bucket, contains, decodeToSortedSet } from '../../src/mesh/bitchat/gcs.ts'
import { FragmentAssemblyBuffer, makePlan, parseFragment } from '../../src/mesh/bitchat/fragments.ts'

const mutant = process.argv.includes('--mutant')
const zlib: Compressor = {
  deflateRaw: (d, cap) => {
    const out = new Uint8Array(deflateRawSync(d, { level: 5 }))
    return out.length > cap ? null : out
  },
  inflateRaw: (d, size) => {
    try {
      return new Uint8Array(inflateRawSync(d, { maxOutputLength: Math.max(size, 1) }))
    } catch {
      return null
    }
  },
}
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
const bytes = (s: unknown): Uint8Array | null => {
  if (typeof s !== 'string') return null
  const h = s.trim().replace(/^0x/i, '')
  if (h.length % 2 || !/^[0-9a-f]*$/i.test(h)) return null
  return new Uint8Array(Buffer.from(h, 'hex'))
}
type J = Record<string, unknown>
const packetFrom = (j: J): BitchatPacket => ({
  type: Number(j.type ?? 0) & 0xff,
  senderID: bytes(j.senderID) ?? new Uint8Array(),
  recipientID: bytes(j.recipientID),
  timestamp: BigInt(typeof j.timestamp === 'string' ? j.timestamp : '0'),
  payload: bytes(j.payload) ?? new Uint8Array(),
  signature: bytes(j.signature),
  ttl: Number(j.ttl ?? 0) & 0xff,
  version: Number(j.version ?? 1) & 0xff,
  route: Array.isArray(j.route) ? (j.route.map(bytes).filter(Boolean) as Uint8Array[]) : null,
  isRSR: Boolean(j.isRSR),
})
const packetJSON = (p: BitchatPacket) => ({
  version: p.version, type: p.type, ttl: mutant ? p.ttl + 1 : p.ttl, timestamp: p.timestamp.toString(),
  senderID: hex(p.senderID), payload: hex(p.payload), isRSR: p.isRSR,
  recipientID: p.recipientID ? hex(p.recipientID) : null, signature: p.signature ? hex(p.signature) : null,
  route: p.route ? p.route.map(hex) : null,
})

function run(input: J): unknown {
  switch (input.op) {
    case 'encode': {
      const out = encode(packetFrom(input.packet as J), input.padding !== false, zlib)
      return out ? hex(out) : null
    }
    case 'decode': {
      const d = bytes(input.hex)
      if (!d) return null
      const p = decode(d, zlib)
      return p ? packetJSON(p) : null
    }
    case 'signingBytes': {
      const out = signingBytes(packetFrom(input.packet as J), zlib)
      return out ? hex(out) : null
    }
    case 'packetId':
      return hex(packetId(packetFrom(input.packet as J)))
    case 'gcsBuild': {
      const ids = ((input.ids as string[]) ?? []).map(bytes).filter(Boolean) as Uint8Array[]
      const params = buildFilter(ids, Number(input.maxBytes ?? 400), Number(input.targetFpr ?? 0.01))
      const sorted = decodeToSortedSet(params.p, params.m, params.data)
      return {
        p: params.p, m: params.m, data: hex(params.data), includedCount: params.includedCount,
        decoded: sorted.map(String), membership: ids.map((id) => contains(sorted, bucket(id, params.m))),
      }
    }
    case 'gcsDecode':
      return decodeToSortedSet(Number(input.p ?? 1), Number(input.m ?? 1), bytes(input.data) ?? new Uint8Array()).map(String)
    case 'gcsBucket':
      return bucket(bytes(input.id) ?? new Uint8Array(), Number(input.m ?? 1)).toString()
    case 'fragmentPlan': {
      const plan = makePlan(
        { packet: packetFrom(input.packet as J), pad: Boolean(input.pad), maxChunk: (input.maxChunk as number) ?? null, directedPeer: (input.directedPeer as string) ?? null },
        Number(input.defaultChunkSize ?? 469), Number(input.bleMaxMTU ?? 512), bytes(input.fragmentID) ?? new Uint8Array(8), zlib,
      )
      return plan && { chunkSize: plan.chunkSize, fragmentVersion: plan.fragmentVersion, spacingMs: plan.spacingMs, fragments: plan.fragments.map(packetJSON) }
    }
    case 'reassemble': {
      const buffer = new FragmentAssemblyBuffer()
      return ((input.fragments as J[]) ?? []).map((f) => {
        const header = parseFragment(packetFrom(f))
        if (!header) return { result: 'invalid' }
        const r = buffer.append(header, Number(input.maxInFlight ?? 128), 1_700_000_000_000)
        return r.result === 'complete' ? { ...r, data: hex(r.data) } : r
      })
    }
    default:
      return { error: `unknown op ${String(input.op)}` }
  }
}

let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => process.stdout.write(JSON.stringify({ out: run(JSON.parse(raw || '{}')) })))
