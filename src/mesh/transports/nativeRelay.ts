import { ChunkAssembler, chunkFrame } from '../protocol'
import { MeshTransport } from '../transport'
import { NUS_RX, NUS_SERVICE, NUS_TX } from './bluetoothGatt'

/** The slice of @capacitor-community/bluetooth-le the relay transport uses. */
export interface NativeBleCentral {
  initialize(options?: { androidNeverForLocation?: boolean }): Promise<void>
  requestDevice(options: { services?: string[]; namePrefix?: string; optionalServices?: string[] }): Promise<{ deviceId: string; name?: string }>
  connect(deviceId: string, onDisconnect?: (deviceId: string) => void): Promise<void>
  disconnect(deviceId: string): Promise<void>
  getMtu(deviceId: string): Promise<number>
  startNotifications(deviceId: string, service: string, characteristic: string, callback: (value: DataView) => void): Promise<void>
  writeWithoutResponse(deviceId: string, service: string, characteristic: string, value: DataView): Promise<void>
}

/**
 * Same wire protocol as BluetoothRelayTransport (Nordic UART + chunked frames), driven through the
 * Capacitor BLE plugin so it works in the iOS and Android shells, where Web Bluetooth doesn't exist.
 * Uses the negotiated MTU for packet size and reconnects with backoff when the relay drops.
 */
export class NativeBluetoothRelayTransport extends MeshTransport {
  readonly id = `ble-native-${Math.random().toString(36).slice(2, 8)}`
  label = 'Bluetooth relay'
  private deviceId: string | null = null
  private readonly assembler = new ChunkAssembler()
  private seq = Math.floor(Math.random() * 0xffff)
  private packetBytes = 20
  private queue: Promise<void> = Promise.resolve()
  private manualStop = false

  constructor(
    private readonly ble: NativeBleCentral,
    private readonly namePrefix = 'GrahmOS',
  ) {
    super()
  }

  async start() {
    this.manualStop = false
    this.setStatus('connecting')
    try {
      await this.ble.initialize()
      const device = await this.ble.requestDevice({ services: [NUS_SERVICE], optionalServices: [NUS_SERVICE] })
      this.deviceId = device.deviceId
      this.label = `Relay · ${device.name ?? 'BLE node'}`
      await this.connect()
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  private async connect() {
    const id = this.deviceId!
    await this.ble.connect(id, () => this.handleDisconnect())
    try {
      // ATT payload is MTU − 3; stay within a sane range even if the stack reports nonsense.
      this.packetBytes = Math.max(20, Math.min(512, (await this.ble.getMtu(id)) - 3))
    } catch {
      this.packetBytes = 20
    }
    await this.ble.startNotifications(id, NUS_SERVICE, NUS_TX, (value) => {
      const frame = this.assembler.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      if (frame) this.onFrame(frame)
    })
    this.setStatus('up')
  }

  private handleDisconnect() {
    if (this.manualStop) {
      this.setStatus('down')
      return
    }
    this.setStatus('connecting', 'Reconnecting…')
    void this.reconnect(1)
  }

  private async reconnect(attempt: number) {
    if (this.manualStop || !this.deviceId) return
    try {
      await this.connect()
    } catch {
      if (attempt >= 6) {
        this.setStatus('down', 'Relay out of range')
        return
      }
      setTimeout(() => void this.reconnect(attempt + 1), Math.min(30_000, 1000 * 2 ** attempt))
    }
  }

  stop() {
    this.manualStop = true
    if (this.deviceId) void this.ble.disconnect(this.deviceId).catch(() => {})
    this.setStatus('down')
  }

  send(frame: string) {
    const id = this.deviceId
    if (!id || this.status !== 'up') return
    this.seq = (this.seq + 1) & 0xffff
    const packets = chunkFrame(frame, this.seq, this.packetBytes)
    this.queue = this.queue
      .then(async () => {
        for (const packet of packets) {
          await this.ble.writeWithoutResponse(id, NUS_SERVICE, NUS_RX, new DataView(packet.buffer, packet.byteOffset, packet.byteLength))
        }
      })
      .catch((error) => this.setStatus('error', error instanceof Error ? error.message : String(error)))
  }
}
