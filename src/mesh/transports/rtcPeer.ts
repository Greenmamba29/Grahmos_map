/**
 * Minimal WebRTC data-channel peer with simple-peer's API (feross/simple-peer v9.11.1 @ f1a492d, MIT),
 * written on the browser's native RTCPeerConnection without Node polyfills (readable-stream, buffer,
 * randombytes): ~5 KB instead of simplepeer.min.js's 99 KB.
 *
 * Observable behaviour matches upstream (rea/simple-peer/golden.json), quirks included:
 *  - non-trickle signals one {type:'offer'|'answer', sdp} after ICE gathering completes;
 *  - without objectMode, incoming strings are delivered as bytes (upstream's Buffer);
 *  - send() before the channel opens throws the browser's InvalidStateError;
 *  - when the remote side destroys, this side's data channel reports ERR_DATA_CHANNEL before 'close'.
 * Self-contained on purpose (no imports) so the REA harness can load it into a page after type stripping.
 */

type Listener = (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any

export interface RtcSignal {
  type: 'offer' | 'answer' | 'candidate'
  sdp?: string
  candidate?: RTCIceCandidateInit
}

export interface RtcPeerOptions {
  initiator?: boolean
  trickle?: boolean
  objectMode?: boolean
  config?: RTCConfiguration
  channelName?: string
  /** Non-trickle: send the description anyway this long after the first candidate (upstream: 5 s). */
  iceCompleteTimeout?: number
}

export class RtcPeer {
  readonly initiator: boolean
  connected = false
  destroyed = false
  private readonly trickle: boolean
  private readonly objectMode: boolean
  private readonly pc: RTCPeerConnection
  private channel: RTCDataChannel | null = null
  private readonly listeners = new Map<string, Set<Listener>>()
  private pendingCandidates: RTCIceCandidateInit[] = []
  private iceComplete = false
  private iceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly iceCompleteTimeout: number
  private descriptionPending = false

  constructor(options: RtcPeerOptions = {}) {
    this.initiator = Boolean(options.initiator)
    this.trickle = options.trickle !== false
    this.objectMode = Boolean(options.objectMode)
    this.iceCompleteTimeout = options.iceCompleteTimeout ?? 5000
    this.pc = new RTCPeerConnection(options.config ?? { iceServers: [] })
    // Gathering can stall forever on some networks (it does in headless Chromium here), so like upstream:
    // ICE is "complete" on the null candidate OR iceCompleteTimeout after the first real candidate.
    this.pc.onicecandidate = (event) => {
      if (this.destroyed) return
      if (event.candidate && this.trickle) {
        const c = event.candidate
        this.emit('signal', { type: 'candidate', candidate: { candidate: c.candidate, sdpMLineIndex: c.sdpMLineIndex, sdpMid: c.sdpMid } })
      } else if (!event.candidate) this.markIceComplete()
      if (event.candidate && !this.iceTimer) this.iceTimer = setTimeout(() => this.markIceComplete(), this.iceCompleteTimeout)
    }
    if (this.initiator) {
      this.attachChannel(this.pc.createDataChannel(options.channelName ?? 'grahmos', { ordered: true }))
      void this.negotiate()
    } else {
      this.pc.ondatachannel = (event) => this.attachChannel(event.channel)
    }
  }

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener)
    return this
  }

  once(event: string, listener: Listener) {
    const wrapped: Listener = (...args) => {
      this.off(event, wrapped)
      listener(...args)
    }
    return this.on(event, wrapped)
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  private emit(event: string, ...args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args)
  }

  private markIceComplete() {
    if (this.iceComplete) return
    this.iceComplete = true
    if (this.descriptionPending) this.emitDescription()
  }

  private async negotiate() {
    try {
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      this.sendDescription()
    } catch (error) {
      this.fail('ERR_CREATE_OFFER', error)
    }
  }

  private sendDescription() {
    if (this.trickle || this.iceComplete) this.emitDescription()
    else this.descriptionPending = true
  }

  private emitDescription() {
    this.descriptionPending = false
    const d = this.pc.localDescription
    if (d && !this.destroyed) this.emit('signal', { type: d.type, sdp: d.sdp })
  }

  /** Feed a signal produced by the other peer (offer, answer or candidate). */
  async signal(data: RtcSignal | string) {
    if (this.destroyed) return
    const s: RtcSignal = typeof data === 'string' ? JSON.parse(data) : data
    try {
      if (s.type === 'candidate' && s.candidate) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(s.candidate)
        else this.pendingCandidates.push(s.candidate)
        return
      }
      if (s.type === 'offer' || s.type === 'answer') {
        await this.pc.setRemoteDescription({ type: s.type, sdp: s.sdp })
        for (const c of this.pendingCandidates) await this.pc.addIceCandidate(c)
        this.pendingCandidates = []
        if (s.type === 'offer') {
          const answer = await this.pc.createAnswer()
          await this.pc.setLocalDescription(answer)
          this.sendDescription()
        }
      }
    } catch (error) {
      this.fail('ERR_SET_REMOTE_DESCRIPTION', error)
    }
  }

  private attachChannel(channel: RTCDataChannel) {
    this.channel = channel
    channel.binaryType = 'arraybuffer'
    channel.onopen = () => {
      if (this.connected || this.destroyed) return
      this.connected = true
      this.emit('connect')
    }
    channel.onmessage = (event) => {
      const d = event.data
      if (typeof d === 'string') this.emit('data', this.objectMode ? d : new TextEncoder().encode(d))
      else this.emit('data', new Uint8Array(d as ArrayBuffer))
    }
    channel.onclose = () => this.destroy()
    channel.onerror = (event) => this.fail('ERR_DATA_CHANNEL', (event as RTCErrorEvent).error)
  }

  /** Strings and bytes; throws the browser's InvalidStateError if the channel is not open yet. */
  send(data: string | Uint8Array) {
    if (!this.channel) throw new DOMException('data channel not created yet', 'InvalidStateError')
    if (typeof data === 'string') this.channel.send(data)
    else this.channel.send(data as Uint8Array<ArrayBuffer>)
  }

  private fail(code: string, error: unknown) {
    if (this.destroyed) return
    // Wrap instead of mutating: RTCError is a DOMException whose `code` is read-only, so assigning it throws
    // inside the event handler and the error is silently lost (found by the REA golden, 2026-11-08).
    const err = new Error(error instanceof Error ? error.message : String(error ?? code), { cause: error }) as Error & { code: string }
    err.code = code
    this.emit('error', err)
    this.destroy()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.connected = false
    if (this.iceTimer) clearTimeout(this.iceTimer)
    // Upstream quirk (kept): the connection is torn down abruptly, so the REMOTE side's data channel reports
    // "User-Initiated Abort" (ERR_DATA_CHANNEL) before 'close'. WebRtcTransport treats that as a normal leave.
    this.pc.close()
    try {
      this.channel?.close()
    } catch {
      // already closed
    }
    this.emit('close')
  }
}
