import { LwwMap, type LwwEntry } from './crdt'
import { HybridLogicalClock } from './hlc'
import {
  MESH_PROTOCOL_VERSION,
  decodeEnvelope,
  encodeEnvelope,
  randomId,
  type Annotation,
  type MeshBody,
  type MeshEnvelope,
  type PeerPresence,
} from './protocol'
import type { MeshTransport } from './transport'

export interface MeshNodeOptions {
  peerId: string
  name: string
  venueId?: string
  now?: () => number
  /** Default flood radius in hops. */
  defaultTtl?: number
  initialAnnotations?: LwwEntry<Annotation>[]
}

export interface MeshStats {
  sent: number
  received: number
  relayed: number
  duplicates: number
  rejected: number
}

export interface MeshMessage {
  id: string
  from: string
  fromName: string
  text: string
  at: number
  hops: number
}

const MAX_FRAME_CHARS = 512 * 1024
const SEEN_TTL_MS = 10 * 60 * 1000
const PRESENCE_TTL_MS = 90 * 1000

/**
 * Store-and-forward flooding mesh node with CRDT anti-entropy.
 *
 * - Every envelope carries a unique id and a hop budget (TTL); nodes drop
 *   duplicates and relay the rest over all *other* links, so messages hop
 *   across phones, tabs and BLE relay radios without any infrastructure.
 * - Shared map state (closures, hazards, SOS) is a last-writer-wins CRDT,
 *   reconciled by digest exchange whenever a link comes up, so devices that
 *   were never online at the same time still converge via intermediaries.
 */
export class MeshNode {
  readonly peerId: string
  name: string
  venueId?: string
  readonly clock: HybridLogicalClock
  readonly annotations: LwwMap<Annotation>
  readonly stats: MeshStats = { sent: 0, received: 0, relayed: 0, duplicates: 0, rejected: 0 }
  readonly messages: MeshMessage[] = []
  onVenue: (venue: unknown, from: string) => void = () => {}

  private readonly peers = new Map<string, PeerPresence>()
  private readonly seen = new Map<string, number>()
  private readonly transports = new Set<MeshTransport>()
  private readonly listeners = new Set<() => void>()
  private readonly now: () => number
  private readonly defaultTtl: number
  private version = 0

  constructor(options: MeshNodeOptions) {
    this.peerId = options.peerId
    this.name = options.name
    this.venueId = options.venueId
    this.now = options.now ?? (() => Date.now())
    this.defaultTtl = options.defaultTtl ?? 6
    this.clock = new HybridLogicalClock(this.peerId, this.now)
    this.annotations = new LwwMap(options.initialAnnotations)
  }

  setVenue(venueId: string | undefined) {
    this.venueId = venueId
    this.sync()
  }

  setName(name: string) {
    this.name = name
    this.sync()
  }

  setVenueHandler(handler: (venue: unknown, from: string) => void) {
    this.onVenue = handler
  }

  /** Monotonic counter bumped on every observable change (for React). */
  get revision() {
    return this.version
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    this.version++
    for (const listener of this.listeners) listener()
  }

  addTransport(transport: MeshTransport) {
    this.transports.add(transport)
    transport.onFrame = (frame) => this.receive(frame, transport)
    transport.onStatusChange = () => this.emit()
    transport.onLinkUp = () => this.syncOn(transport)
    if (transport.status === 'up') transport.onLinkUp()
    this.emit()
  }

  removeTransport(transport: MeshTransport) {
    transport.stop()
    this.transports.delete(transport)
    this.emit()
  }

  links() {
    return [...this.transports]
  }

  activePeers(): PeerPresence[] {
    const cutoff = this.now() - PRESENCE_TTL_MS
    return [...this.peers.values()].filter((p) => p.at >= cutoff && p.peerId !== this.peerId)
  }

  activeAnnotations(venueId = this.venueId): Annotation[] {
    const now = this.now()
    return this.annotations
      .values()
      .filter((a) => (!venueId || a.venueId === venueId) && !a.resolved && (!a.expiresAt || a.expiresAt > now))
  }

  private envelope(body: MeshBody, ttl = this.defaultTtl): MeshEnvelope {
    return {
      v: MESH_PROTOCOL_VERSION,
      id: randomId(),
      origin: this.peerId,
      ttl,
      hops: 0,
      hlc: this.clock.tick(),
      body,
    }
  }

  private broadcast(envelope: MeshEnvelope, except?: MeshTransport) {
    this.seen.set(envelope.id, this.now())
    const frame = encodeEnvelope(envelope)
    for (const transport of this.transports) {
      if (transport === except || transport.status !== 'up') continue
      transport.send(frame)
      this.stats.sent++
    }
  }

  private sendOn(transport: MeshTransport, envelope: MeshEnvelope) {
    if (transport.status !== 'up') return
    this.seen.set(envelope.id, this.now())
    transport.send(encodeEnvelope(envelope))
    this.stats.sent++
  }

  /** Creates or updates an annotation locally and floods it to the mesh. */
  publishAnnotation(annotation: Annotation) {
    const entry: LwwEntry<Annotation> = { key: annotation.id, value: annotation, hlc: this.clock.tick() }
    this.annotations.merge(entry)
    this.broadcast(this.envelope({ kind: 'ops', entries: [entry] }))
    this.emit()
    return entry
  }

  /** Merges entries from local storage or an import; emits when state changed. */
  restore(entries: LwwEntry<Annotation>[]) {
    let changed = false
    for (const entry of entries) if (isAnnotationEntry(entry)) changed = this.annotations.merge(entry) || changed
    if (changed) this.emit()
    return changed
  }

  resolveAnnotation(id: string) {
    const current = this.annotations.get(id)
    if (!current) return
    this.publishAnnotation({ ...current, resolved: true })
  }

  updatePresence(presence: Omit<PeerPresence, 'peerId' | 'name' | 'at' | 'venueId'>) {
    const full: PeerPresence = {
      ...presence,
      peerId: this.peerId,
      name: this.name,
      venueId: this.venueId,
      at: this.now(),
    }
    this.broadcast(this.envelope({ kind: 'presence', presence: full }, 3))
  }

  sendText(text: string) {
    const envelope = this.envelope({ kind: 'text', text: text.slice(0, 500) })
    this.recordMessage(envelope, this.name, text)
    this.broadcast(envelope)
    this.emit()
  }

  shareVenue(venue: unknown) {
    this.broadcast(this.envelope({ kind: 'venue', venue }, 2))
  }

  /** Runs anti-entropy with every connected neighbour. */
  sync() {
    for (const transport of this.transports) this.syncOn(transport)
    this.pruneSeen()
  }

  private hello(): MeshBody {
    return { kind: 'hello', name: this.name, venueId: this.venueId }
  }

  /** Hello doubles as a heartbeat so neighbours keep us in their peer list. */
  private syncOn(transport: MeshTransport) {
    this.sendOn(transport, this.envelope(this.hello(), 0))
    this.sendOn(
      transport,
      this.envelope({ kind: 'digest', venueId: this.venueId ?? '*', digest: this.digestFor(this.venueId) }, 0),
    )
  }

  private digestFor(venueId?: string) {
    const out: Record<string, string> = {}
    for (const entry of this.annotations.all()) {
      if (!venueId || venueId === '*' || entry.value.venueId === venueId) out[entry.key] = entry.hlc
    }
    return out
  }

  private pruneSeen() {
    const cutoff = this.now() - SEEN_TTL_MS
    for (const [id, at] of this.seen) if (at < cutoff) this.seen.delete(id)
  }

  /** Entry point for frames arriving from any transport. */
  receive(frame: string, from?: MeshTransport) {
    if (frame.length > MAX_FRAME_CHARS) {
      this.stats.rejected++
      return
    }
    const envelope = decodeEnvelope(frame)
    if (!envelope) {
      this.stats.rejected++
      return
    }
    if (envelope.origin === this.peerId || this.seen.has(envelope.id)) {
      this.stats.duplicates++
      return
    }
    if (!this.clock.receive(envelope.hlc)) {
      this.stats.rejected++
      return
    }
    this.seen.set(envelope.id, this.now())
    this.stats.received++
    if (this.seen.size > 5000) this.pruneSeen()

    const changed = this.handle(envelope, from)

    if (envelope.ttl > 0) {
      this.broadcast({ ...envelope, ttl: envelope.ttl - 1, hops: envelope.hops + 1 }, from)
      this.stats.relayed++
    }
    if (changed) this.emit()
  }

  private handle(envelope: MeshEnvelope, from?: MeshTransport): boolean {
    const body = envelope.body
    switch (body.kind) {
      case 'hello': {
        const existing = this.peers.get(envelope.origin)
        const fresh = !existing || this.now() - existing.at > PRESENCE_TTL_MS
        this.peers.set(envelope.origin, {
          ...existing,
          peerId: envelope.origin,
          name: String(body.name).slice(0, 40),
          venueId: body.venueId,
          at: this.now(),
        })
        // Introduce ourselves to newcomers so discovery is symmetric. The peer
        // is recorded first, so the reply cannot bounce back and forth.
        if (fresh && from) this.sendOn(from, this.envelope(this.hello(), 0))
        return true
      }
      case 'presence': {
        const p = body.presence
        if (!p || p.peerId !== envelope.origin) return false
        this.peers.set(p.peerId, { ...p, name: String(p.name).slice(0, 40), at: this.now() })
        return true
      }
      case 'ops': {
        let changed = false
        for (const entry of body.entries ?? []) {
          if (!isAnnotationEntry(entry)) continue
          changed = this.annotations.merge(entry) || changed
        }
        return changed
      }
      case 'digest': {
        if (!from) return false
        const missing = this.annotations
          .newerThan(body.digest ?? {})
          .filter((e) => body.venueId === '*' || e.value.venueId === body.venueId)
        if (missing.length) this.sendOn(from, this.envelope({ kind: 'ops', entries: missing }, 0))
        if (!body.reply && this.annotations.remoteHasNewer(body.digest ?? {})) {
          this.sendOn(
            from,
            this.envelope({ kind: 'digest', venueId: body.venueId, digest: this.digestFor(body.venueId), reply: true }, 0),
          )
        }
        return false
      }
      case 'venue':
        this.onVenue(body.venue, envelope.origin)
        return false
      case 'text': {
        const name = this.peers.get(envelope.origin)?.name ?? envelope.origin.slice(0, 6)
        this.recordMessage(envelope, name, String(body.text).slice(0, 500))
        return true
      }
      default:
        return false
    }
  }

  private recordMessage(envelope: MeshEnvelope, fromName: string, text: string) {
    this.messages.push({
      id: envelope.id,
      from: envelope.origin,
      fromName,
      text,
      at: this.now(),
      hops: envelope.hops,
    })
    if (this.messages.length > 100) this.messages.splice(0, this.messages.length - 100)
  }
}

function isAnnotationEntry(entry: unknown): entry is LwwEntry<Annotation> {
  const e = entry as LwwEntry<Annotation>
  return (
    typeof e?.key === 'string' &&
    typeof e.hlc === 'string' &&
    typeof e.value?.id === 'string' &&
    e.value.id === e.key &&
    typeof e.value.levelId === 'string' &&
    Array.isArray(e.value.position) &&
    typeof e.value.radius === 'number'
  )
}
