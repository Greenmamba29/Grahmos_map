import { MeshTransport } from '../transport'

/**
 * Links every tab/window of the app on this device. Useful as a zero-setup
 * demo of the mesh and as the hop between a kiosk tab and a BLE-connected tab.
 */
export class BroadcastChannelTransport extends MeshTransport {
  readonly id = 'broadcast-channel'
  readonly label = 'This device (tabs)'
  private channel: BroadcastChannel | null = null

  constructor(private readonly channelName = 'grahmos-mesh-v1') {
    super()
  }

  static isSupported() {
    return typeof BroadcastChannel !== 'undefined'
  }

  async start() {
    if (!BroadcastChannelTransport.isSupported()) {
      this.setStatus('error', 'BroadcastChannel unavailable')
      return
    }
    this.channel = new BroadcastChannel(this.channelName)
    this.channel.onmessage = (event) => {
      if (typeof event.data === 'string') this.onFrame(event.data)
    }
    this.setStatus('up')
  }

  stop() {
    this.channel?.close()
    this.channel = null
    this.setStatus('down')
  }

  send(frame: string) {
    this.channel?.postMessage(frame)
  }
}
