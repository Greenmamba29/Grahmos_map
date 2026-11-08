import type { MeshNode } from '../node'
import { MeshTransport } from '../transport'
import { RtcPeer, type RtcSignal } from './rtcPeer'

/** The RtcPeer surface the link needs (lets tests substitute a fake pair). */
export interface PeerLike {
  on(event: string, listener: (...args: any[]) => void): unknown // eslint-disable-line @typescript-eslint/no-explicit-any
  signal(data: RtcSignal): unknown
  send(data: string): void
  destroy(): void
}

/** One direct WebRTC data channel to one peer, as a mesh link. */
export class RtcLinkTransport extends MeshTransport {
  readonly id: string
  readonly label: string

  constructor(
    readonly remotePeerId: string,
    readonly peer: PeerLike,
  ) {
    super()
    this.id = `rtc-${remotePeerId}`
    this.label = `Direct Wi-Fi link · ${remotePeerId.slice(0, 6)}`
    this.setStatus('connecting')
    peer.on('connect', () => this.setStatus('up'))
    peer.on('data', (d: string | Uint8Array) => this.onFrame(typeof d === 'string' ? d : new TextDecoder().decode(d)))
    peer.on('close', () => this.setStatus('down'))
    // Upstream quirk kept by RtcPeer: the remote side leaving surfaces as ERR_DATA_CHANNEL. That is a
    // normal departure for a mesh link, not a failure worth showing the user.
    peer.on('error', (e: { code?: string; message?: string }) => {
      if (e.code !== 'ERR_DATA_CHANNEL') this.detail = e.message
    })
  }

  async start() {}

  stop() {
    this.peer.destroy()
  }

  send(frame: string) {
    if (this.status !== 'up') return
    try {
      this.peer.send(frame)
    } catch {
      this.setStatus('down')
    }
  }
}

export type PeerFactory = (initiator: boolean) => PeerLike

/**
 * Upgrades mesh neighbours to direct WebRTC links. Signalling travels as signed mesh messages over any
 * existing link (BLE relay, tabs), so two phones on the same Wi-Fi with no internet get a fast direct
 * channel for big payloads like venue maps. The lower peer id initiates, so both sides never offer at once.
 */
export class RtcLinkManager {
  private readonly links = new Map<string, RtcLinkTransport>()

  constructor(
    private readonly node: MeshNode,
    private readonly factory: PeerFactory = (initiator) =>
      new RtcPeer({ initiator, trickle: false, objectMode: true, config: { iceServers: [] } }),
  ) {
    node.onRtcSignal = (from, signal) => this.onSignal(from, signal as RtcSignal)
  }

  connect(remote: string) {
    if (this.links.has(remote) || remote === this.node.peerId) return
    if (this.node.peerId > remote) {
      // The other side initiates; nudge it with an empty answer-less ping by connecting from its end.
      this.node.sendRtcSignal(remote, { type: 'candidate' })
      return
    }
    this.open(remote, true)
  }

  /** Connects to every currently active peer. */
  connectAll() {
    for (const p of this.node.activePeers()) this.connect(p.peerId)
  }

  private open(remote: string, initiator: boolean) {
    const peer = this.factory(initiator)
    const link = new RtcLinkTransport(remote, peer)
    peer.on('signal', (s: RtcSignal) => this.node.sendRtcSignal(remote, s))
    peer.on('close', () => {
      // Guard: removeTransport() calls stop() → destroy() → 'close' again on peers that aren't idempotent.
      if (this.links.get(remote) !== link) return
      this.links.delete(remote)
      this.node.removeTransport(link)
    })
    this.links.set(remote, link)
    this.node.addTransport(link)
    return link
  }

  private onSignal(from: string, signal: RtcSignal) {
    let link = this.links.get(from)
    if (!link) {
      // A bare candidate with no payload is the "please initiate" nudge from a higher peer id.
      if (signal.type === 'candidate' && !signal.candidate) {
        if (this.node.peerId < from) this.open(from, true)
        return
      }
      if (signal.type !== 'offer') return
      link = this.open(from, false)
    }
    if (signal.type === 'candidate' && !signal.candidate) return
    link.peer.signal(signal)
  }

  close() {
    for (const link of [...this.links.values()]) link.stop()
    this.links.clear()
  }
}
