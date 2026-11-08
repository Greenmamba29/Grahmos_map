/**
 * Port of bitchat's Golomb-Coded Set sync filter (bitchat/Sync/GCSFilter.swift @ 04995f6, Unlicense).
 * A peer sends a compact filter of the packet ids it holds; the other side replies with packets that are
 * not in it. ~P+2 bits per id instead of a full {key: hlc} digest. Parity-proven against the golden.
 */
import { sha256 } from '@noble/hashes/sha2.js'

export interface GcsParams {
  p: number
  m: number
  data: Uint8Array
  includedCount: number
}

export const MAX_P = 32
const U32_MAX = 0xffffffffn

export function deriveP(targetFpr: number) {
  const f = Math.max(0.000001, Math.min(0.25, targetFpr))
  return Math.max(1, Math.ceil(Math.log2(1 / f)))
}

export function estimateMaxElements(sizeBytes: number, p: number) {
  const bits = Math.max(8, sizeBytes * 8)
  const per = Math.max(3, p + 2)
  return Math.max(1, Math.floor(bits / per))
}

function h64(id: Uint8Array): bigint {
  const d = sha256(id)
  let x = 0n
  for (let i = 0; i < 8; i++) x = (x << 8n) | BigInt(d[i])
  return x & 0x7fffffffffffffffn
}

function hashRange(count: number, p: number): bigint {
  if (count <= 0) return 1n
  if (p >= 64) return U32_MAX
  const product = BigInt(count) << BigInt(p)
  if (product >= 1n << 64n) return U32_MAX
  if (product === 0n) return 1n
  return product > U32_MAX ? U32_MAX : product
}

function mapHash(hash: bigint, modulo: bigint) {
  if (modulo <= 1n) return 0n
  const v = hash % modulo
  return v === 0n ? 1n : v
}

function normalize(values: bigint[], modulo: bigint) {
  if (modulo <= 1n || !values.length) return []
  const out: bigint[] = []
  let last = 0n
  for (const v of values) {
    const n = v < modulo - 1n ? v : modulo - 1n
    if (n > last) {
      out.push(n)
      last = n
    }
  }
  return out
}

class BitWriter {
  private buf: number[] = []
  private cur = 0
  private n = 0
  bit(b: number) {
    this.cur = ((this.cur << 1) | (b & 1)) & 0xff
    if (++this.n === 8) {
      this.buf.push(this.cur)
      this.cur = 0
      this.n = 0
    }
  }
  bits(value: bigint, count: number) {
    for (let i = count - 1; i >= 0; i--) this.bit(Number((value >> BigInt(i)) & 1n))
  }
  done() {
    if (this.n > 0) {
      this.buf.push((this.cur << (8 - this.n)) & 0xff)
      this.cur = 0
      this.n = 0
    }
    return Uint8Array.from(this.buf)
  }
}

function encodeSorted(sorted: bigint[], p: number) {
  const w = new BitWriter()
  const mask = p >= 64 ? (1n << 64n) - 1n : (1n << BigInt(p)) - 1n
  let prev = 0n
  for (const v of sorted) {
    const x = (v - prev - 1n) & ((1n << 64n) - 1n)
    prev = v
    const q = x >> BigInt(p)
    for (let i = 0n; i < q; i++) w.bit(1)
    w.bit(0)
    w.bits(x & mask, p)
  }
  return w.done()
}

export function buildFilter(ids: Uint8Array[], maxBytes: number, targetFpr: number): GcsParams {
  const p = deriveP(targetFpr)
  if (!ids.length) return { p, m: 1, data: new Uint8Array(), includedCount: 0 }
  const cap = estimateMaxElements(maxBytes, p)
  const range = hashRange(Math.min(ids.length, cap), p)
  const modulo = range > 1n ? range : 1n
  const encodeFirst = (count: number) => {
    const mapped = ids.slice(0, count).map((id) => mapHash(h64(id), modulo)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const normalized = normalize(mapped, modulo)
    return normalized.length ? encodeSorted(normalized, p) : new Uint8Array()
  }
  let count = Math.min(ids.length, cap)
  let encoded = encodeFirst(count)
  while (encoded.length > maxBytes && count > 1) {
    count = Math.max(1, Math.floor((count * 9) / 10))
    encoded = encodeFirst(count)
  }
  if (encoded.length > maxBytes) return { p, m: Number(modulo), data: new Uint8Array(), includedCount: 0 }
  return { p, m: Number(modulo), data: encoded, includedCount: encoded.length ? count : 0 }
}

export function decodeToSortedSet(p: number, m: number, data: Uint8Array): bigint[] {
  if (p < 1 || p > MAX_P || m <= 1) return []
  let idx = 0
  let cur = data.length ? data[0] : 0
  let left = data.length ? 8 : 0
  const readBit = (): number | null => {
    if (idx >= data.length) return null
    const b = (cur >> 7) & 1
    cur = (cur << 1) & 0xff
    if (--left === 0) {
      idx++
      if (idx < data.length) {
        cur = data[idx]
        left = 8
      }
    }
    return b
  }
  const values: bigint[] = []
  let acc = 0n
  for (;;) {
    let q = 0n
    let b: number | null
    while ((b = readBit()) === 1) q++
    if (b === null) break
    let r = 0n
    let ok = true
    for (let i = 0; i < p; i++) {
      const bit = readBit()
      if (bit === null) {
        ok = false
        break
      }
      r = (r << 1n) | BigInt(bit)
    }
    if (!ok) break
    acc = (acc + (q << BigInt(p)) + r + 1n) & ((1n << 64n) - 1n)
    if (acc >= BigInt(m)) break
    values.push(acc)
  }
  return values
}

export function contains(sorted: bigint[], candidate: bigint) {
  let lo = 0
  let hi = sorted.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] === candidate) return true
    if (sorted[mid] < candidate) lo = mid + 1
    else hi = mid - 1
  }
  return false
}

export function bucket(id: Uint8Array, m: number) {
  const modulo = BigInt(Math.max(1, m))
  if (modulo <= 1n) return 0n
  return mapHash(h64(id), modulo)
}
