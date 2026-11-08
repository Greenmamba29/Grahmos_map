// Generates rea/bitchat/fixtures.json: inputs only. Expected values come from running UNMODIFIED bitchat
// (the Swift reference runner in CI), never from this file.
import { deflateRawSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const hex = (b) => Buffer.from(b).toString('hex')
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i))
const sender = '0102030405060708'
const base = { version: 1, type: 2, ttl: 7, timestamp: '1731000000000', senderID: sender, payload: hex(Buffer.from('hello mesh')), isRSR: false }
const unique = (n) => hex(Buffer.from(rep(n, (i) => (i * 97 + 13) % 256)))
const repetitive = (n) => hex(Buffer.from('GRAHMOS '.repeat(Math.ceil(n / 8)).slice(0, n)))
const f = []
const add = (name, input) => f.push({ name, input })

// ---- encode
add('encode v1 broadcast unpadded', { op: 'encode', packet: base, padding: false })
add('encode v1 broadcast padded', { op: 'encode', packet: base, padding: true })
add('encode recipient + signature', { op: 'encode', packet: { ...base, recipientID: 'a1a2a3a4a5a6a7a8', signature: hex(rep(64, (i) => i)) }, padding: false })
add('encode 99-byte repetitive payload (below threshold)', { op: 'encode', packet: { ...base, payload: repetitive(99) }, padding: false })
add('encode 100-byte repetitive payload (at threshold)', { op: 'encode', packet: { ...base, payload: repetitive(100) }, padding: false })
add('encode 256-byte high-entropy payload (not compressed)', { op: 'encode', packet: { ...base, payload: unique(256) }, padding: false })
add('encode 600-byte repetitive v2', { op: 'encode', packet: { ...base, version: 2, payload: repetitive(600) }, padding: false })
add('encode v2 with route (short hop padded, long hop truncated)', { op: 'encode', packet: { ...base, version: 2, route: ['0a0b', '1112131415161718191a'] }, padding: false })
add('encode v1 ignores route', { op: 'encode', packet: { ...base, route: ['0a0b0c0d0e0f1011'] }, padding: false })
add('encode empty route hop rejected', { op: 'encode', packet: { ...base, version: 2, route: [''] }, padding: false })
add('encode unicode payload', { op: 'encode', packet: { ...base, payload: hex(Buffer.from('héllo 🗺️ ✓')) }, padding: false })
add('encode short sender padded', { op: 'encode', packet: { ...base, senderID: '0102' }, padding: false })
add('encode long sender truncated', { op: 'encode', packet: { ...base, senderID: '0102030405060708090a' }, padding: false })
add('encode max timestamp', { op: 'encode', packet: { ...base, timestamp: '18446744073709551615' }, padding: false })
add('encode isRSR flag', { op: 'encode', packet: { ...base, isRSR: true }, padding: false })
add('encode unsupported version 3', { op: 'encode', packet: { ...base, version: 3 }, padding: false })
// padding boundaries: header 14 + sender 8 = 22 bytes before payload; block 256 needs size+16 <= 256
add('encode padded 218-byte frame (pads to 256)', { op: 'encode', packet: { ...base, payload: unique(196) }, padding: true })
add('encode padded 240-byte frame (exactly fits 256)', { op: 'encode', packet: { ...base, payload: unique(218) }, padding: true })
add('encode padded 241-byte frame (needs 271 pad bytes: left unpadded)', { op: 'encode', packet: { ...base, payload: unique(219) }, padding: true })
add('encode padded 3000-byte frame (above largest block)', { op: 'encode', packet: { ...base, version: 2, type: 0x22, payload: unique(3000) }, padding: true })

// ---- decode (hand-built frames)
const frame = (o) => {
  const parts = [Buffer.from([o.version ?? 1, o.type ?? 2, o.ttl ?? 3]), Buffer.alloc(8), Buffer.from([o.flags ?? 0])]
  parts[1].writeBigUInt64BE(BigInt(o.ts ?? 1))
  const len = Buffer.alloc(o.version === 2 ? 4 : 2)
  o.version === 2 ? len.writeUInt32BE(o.len) : len.writeUInt16BE(o.len)
  parts.push(len, Buffer.from(o.sender ?? sender, 'hex'), ...(o.rest ?? []))
  return hex(Buffer.concat(parts))
}
const plain = Buffer.from('plain payload')
add('decode minimal v1', { op: 'decode', hex: frame({ len: plain.length, rest: [plain] }) })
add('decode truncated header', { op: 'decode', hex: frame({ len: plain.length, rest: [plain] }).slice(0, 30) })
add('decode payload shorter than declared', { op: 'decode', hex: frame({ len: 50, rest: [plain] }) })
add('decode version 3', { op: 'decode', hex: frame({ version: 3, len: 0 }) })
add('decode empty', { op: 'decode', hex: '' })
add('decode trailing garbage after payload', { op: 'decode', hex: frame({ len: plain.length, rest: [plain, Buffer.from('ffff', 'hex')] }) })
const padded = Buffer.concat([Buffer.from(frame({ len: plain.length, rest: [plain] }), 'hex'), Buffer.alloc(5, 5)])
add('decode PKCS#7-padded frame', { op: 'decode', hex: hex(padded) })
const original = Buffer.from('GRAHMOS '.repeat(40))
const deflated = deflateRawSync(original, { level: 5 })
const origLen = Buffer.alloc(2); origLen.writeUInt16BE(original.length)
add('decode raw-DEFLATE payload from Node zlib (interop)', { op: 'decode', hex: frame({ flags: 0x04, len: deflated.length + 2, rest: [origLen, deflated] }) })
const bogusLen = Buffer.alloc(2); bogusLen.writeUInt16BE(60000)
add('decode compression bomb ratio rejected', { op: 'decode', hex: frame({ flags: 0x04, len: 6, rest: [bogusLen, Buffer.from('03000000', 'hex')] }) })
add('decode message payload above per-type cap', { op: 'decode', hex: frame({ version: 2, len: 70000, rest: [Buffer.alloc(70000, 1)] }) })
add('decode v2 route', { op: 'decode', hex: frame({ version: 2, flags: 0x08, len: plain.length, rest: [Buffer.from([2]), Buffer.from('aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb', 'hex'), plain] }) })
add('decode v1 ignores route flag', { op: 'decode', hex: frame({ flags: 0x08, len: plain.length, rest: [plain] }) })
add('decode signature flag without bytes', { op: 'decode', hex: frame({ flags: 0x02, len: plain.length, rest: [plain] }) })

// ---- signing bytes and packet ids
add('signingBytes zero TTL, no signature, RSR cleared', { op: 'signingBytes', packet: { ...base, ttl: 9, isRSR: true, signature: hex(rep(64, () => 7)) } })
add('signingBytes v2 route', { op: 'signingBytes', packet: { ...base, version: 2, route: ['0a0b0c0d0e0f1011'] } })
for (let i = 0; i < 4; i++) add(`packetId ${i}`, { op: 'packetId', packet: { ...base, timestamp: String(1731000000000 + i), payload: hex(Buffer.from(`msg ${i}`)) } })
add('packetId ignores ttl and signature', { op: 'packetId', packet: { ...base, ttl: 1, signature: hex(rep(64, () => 1)) } })

// ---- GCS filters
const ids = (n, salt) => rep(n, (i) => createHash('sha256').update(`${salt}-${i}`).digest().subarray(0, 16).toString('hex'))
add('gcs 20 ids fpr 0.01', { op: 'gcsBuild', ids: ids(20, 'a'), maxBytes: 400, targetFpr: 0.01 })
add('gcs 300 ids trimmed to 64 bytes', { op: 'gcsBuild', ids: ids(300, 'b'), maxBytes: 64, targetFpr: 0.01 })
add('gcs empty', { op: 'gcsBuild', ids: [], maxBytes: 400, targetFpr: 0.01 })
add('gcs single id fpr 0.25', { op: 'gcsBuild', ids: ids(1, 'c'), maxBytes: 400, targetFpr: 0.25 })
add('gcs fpr clamped below 1e-6', { op: 'gcsBuild', ids: ids(5, 'd'), maxBytes: 400, targetFpr: 0 })
add('gcs duplicate ids', { op: 'gcsBuild', ids: [...ids(3, 'e'), ...ids(3, 'e')], maxBytes: 400, targetFpr: 0.01 })
add('gcs decode garbage bits', { op: 'gcsDecode', p: 7, m: 1000, data: 'ffffffff' })
add('gcs decode empty', { op: 'gcsDecode', p: 7, m: 1000, data: '' })
add('gcs bucket', { op: 'gcsBucket', id: ids(1, 'f')[0], m: 12345 })

// ---- fragmentation
const big = { ...base, type: 0x22, version: 1, payload: unique(1000) }
add('fragment 1000 bytes default chunk', { op: 'fragmentPlan', packet: big, pad: false, defaultChunkSize: 469, bleMaxMTU: 512, fragmentID: '0011223344556677' })
add('fragment maxChunk 32 clamps to 64', { op: 'fragmentPlan', packet: big, pad: false, maxChunk: 32, defaultChunkSize: 469, bleMaxMTU: 512, fragmentID: '0011223344556677' })
add('fragment v2 route sizing from MTU', { op: 'fragmentPlan', packet: { ...big, version: 2, route: ['0a0b0c0d0e0f1011', '1112131415161718'] }, pad: false, defaultChunkSize: 469, bleMaxMTU: 185, fragmentID: '8899aabbccddeeff' })
add('fragment directed peer', { op: 'fragmentPlan', packet: big, pad: false, defaultChunkSize: 469, bleMaxMTU: 512, directedPeer: 'a1a2a3a4a5a6a7a8', fragmentID: '0102030405060708' })
add('fragment bad id length', { op: 'fragmentPlan', packet: big, pad: false, defaultChunkSize: 469, bleMaxMTU: 512, fragmentID: '0102' })

// ---- reassembly (fragment packets built per the upstream payload layout: id8 | index u16 | total u16 | type | data)
const fragPacket = (id, index, total, data, type = 0x22, recipient) => {
  const head = Buffer.alloc(13)
  Buffer.from(id, 'hex').copy(head, 0)
  head.writeUInt16BE(index, 8); head.writeUInt16BE(total, 10); head[12] = type
  return { ...base, type: 0x20, payload: hex(Buffer.concat([head, Buffer.from(data)])), recipientID: recipient }
}
const parts = ['alpha-', 'bravo-', 'charlie']
add('reassemble in order', { op: 'reassemble', fragments: parts.map((p, i) => fragPacket('1111111111111111', i, 3, p)) })
add('reassemble out of order', { op: 'reassemble', fragments: [2, 0, 1].map((i) => fragPacket('2222222222222222', i, 3, parts[i])) })
add('reassemble duplicate index', { op: 'reassemble', fragments: [0, 0, 1, 2].map((i) => fragPacket('3333333333333333', i, 3, parts[i])) })
add('reassemble invalid total 0 and index >= total', { op: 'reassemble', fragments: [fragPacket('4444444444444444', 0, 0, 'x'), fragPacket('4444444444444444', 3, 3, 'x')] })
add('reassemble interleaved streams', { op: 'reassemble', fragments: [fragPacket('5555555555555555', 0, 2, 'a1'), fragPacket('6666666666666666', 0, 2, 'b1'), fragPacket('5555555555555555', 1, 2, 'a2'), fragPacket('6666666666666666', 1, 2, 'b2')] })
add('reassemble eviction at maxInFlight 1', { op: 'reassemble', maxInFlight: 1, fragments: [fragPacket('7777777777777777', 0, 2, 'a1'), fragPacket('8888888888888888', 0, 2, 'b1'), fragPacket('7777777777777777', 1, 2, 'a2')] })
add('reassemble oversized message stream', { op: 'reassemble', fragments: rep(80, (i) => fragPacket('9999999999999999', i, 80, 'z'.repeat(1000), 0x02)) })
add('reassemble short payload rejected', { op: 'reassemble', fragments: [{ ...base, type: 0x20, payload: '00112233' }] })

writeFileSync(new URL('./fixtures.json', import.meta.url), JSON.stringify(f, null, 1) + '\n')
console.log(`${f.length} fixtures`)
