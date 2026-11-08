import { BitchatLinkCodec } from '../bitchat/link'
import { MeshTransport } from '../transport'

/** The plugin surface this transport uses (lets tests substitute a fake radio). */
export interface BleMeshRadio {
  start(): Promise<void>
  stop(): Promise<void>
  send(options: { data: string }): Promise<void>
  addListener(event: 'packet', listener: (e: { data: string; from: string }) => void): Promise<{ remove: () => Promise<void> }>
  addListener(event: 'peers', listener: (e: { links: number }) => void): Promise<{ remove: () => Promise<void> }>
}

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/**
 * Relay-free phone-to-phone mesh over Bluetooth: every phone is advertiser and scanner at once (native
 * plugin), packets are bitchat-framed envelopes, and flooding + signatures in MeshNode do the rest.
 * Each sending phone gets its own codec on receive so fragment streams from different phones never mix.
 */
export class PeerBleTransport extends MeshTransport {
  readonly id = 'ble-peer'
  readonly label = 'Nearby phones (Bluetooth)'
  links = 0
  private readonly tx = new BitchatLinkCodec(180)
  private readonly rx = new Map<string, BitchatLinkCodec>()
  private handles: { remove: () => Promise<void> }[] = []

  constructor(private readonly radio: BleMeshRadio) {
    super()
  }

  async start() {
    this.setStatus('connecting', 'Looking for phones…')
    this.handles.push(
      await this.radio.addListener('packet', ({ data, from }) => {
        let codec = this.rx.get(from)
        if (!codec) {
          codec = new BitchatLinkCodec(180)
          this.rx.set(from, codec)
        }
        const frame = codec.push(fromB64(data))
        if (frame) this.onFrame(frame)
      }),
      await this.radio.addListener('peers', ({ links }) => {
        this.links = links
        if (links > 0) this.setStatus('up', `${links} phone${links === 1 ? '' : 's'} linked`)
        else this.setStatus('connecting', 'Looking for phones…')
      }),
    )
    try {
      await this.radio.start()
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  stop() {
    for (const h of this.handles) void h.remove()
    this.handles = []
    void this.radio.stop()
    this.setStatus('down')
  }

  send(frame: string) {
    if (this.status !== 'up') return
    let packets: Uint8Array[]
    try {
      packets = this.tx.encode(frame)
    } catch (error) {
      this.detail = error instanceof Error ? error.message : String(error)
      return
    }
    for (const p of packets) void this.radio.send({ data: toB64(p) })
  }
}
