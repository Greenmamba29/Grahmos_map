import * as ed from '@noble/ed25519'
import { sha256, sha512 } from '@noble/hashes/sha2.js'

// Synchronous Ed25519 (noble-ed25519, MIT, audited) so frames are verified inline as they arrive.
ed.hashes.sha512 = sha512

/**
 * A device's mesh identity. The peer id is derived from the public key, so an envelope's `origin`
 * can't be claimed without the matching secret key.
 */
export interface DeviceKey {
  secretKey: Uint8Array
  publicKey: Uint8Array
  publicHex: string
  peerId: string
}

export function toHex(bytes: Uint8Array) {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error('invalid hex')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** 12 hex chars of SHA-256(public key): short enough for UI, 48 bits of collision resistance. */
export function peerIdFor(publicHex: string) {
  return toHex(sha256(fromHex(publicHex))).slice(0, 12)
}

export function keyFromSecret(secretKey: Uint8Array): DeviceKey {
  const publicKey = ed.getPublicKey(secretKey)
  const publicHex = toHex(publicKey)
  return { secretKey, publicKey, publicHex, peerId: peerIdFor(publicHex) }
}

/** New random key, or a deterministic one from a 32-byte seed (tests and simulations). */
export function generateKey(seed?: Uint8Array): DeviceKey {
  return keyFromSecret(seed ?? ed.utils.randomSecretKey())
}

/** Deterministic JSON: object keys sorted at every depth, so signer and verifier hash identical bytes. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

const encoder = new TextEncoder()

export function signPayload(key: DeviceKey, payload: unknown): string {
  return toHex(ed.sign(encoder.encode(canonical(payload)), key.secretKey))
}

/** True only for a well-formed key and a valid signature over exactly this payload. Never throws. */
export function verifyPayload(publicHex: unknown, signatureHex: unknown, payload: unknown): boolean {
  if (typeof publicHex !== 'string' || typeof signatureHex !== 'string') return false
  if (publicHex.length !== 64 || signatureHex.length !== 128) return false
  try {
    return ed.verify(fromHex(signatureHex), encoder.encode(canonical(payload)), fromHex(publicHex))
  } catch {
    return false
  }
}
