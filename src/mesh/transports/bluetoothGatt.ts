import { ChunkAssembler, chunkFrame } from '../protocol'
import { MeshTransport } from '../transport'

/**
 * Nordic UART Service — the de-facto open BLE serial profile supported by
 * ESP32/nRF52 firmware (Arduino, Zephyr, Adafruit Bluefruit, ESP-IDF), so any
 * cheap microcontroller can act as a battery-powered mesh relay node.
 */
export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
/** Central → peripheral (write). */
export const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
/** Peripheral → central (notify). */
export const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

export interface BluetoothRelayOptions {
  /** Max bytes per GATT write; 20 is safe on any link, 180+ after MTU exchange. */
  packetBytes?: number
  namePrefix?: string
}

/**
 * Connects the browser (as BLE central) to a nearby relay node that speaks
 * the GrahmOS chunked frame protocol over Nordic UART. The relay rebroadcasts
 * frames over its own radio fabric (BLE advertising, ESP-NOW, LoRa) and back
 * to every other connected phone, extending the mesh beyond Wi-Fi.
 */
export class BluetoothRelayTransport extends MeshTransport {
  readonly id: string
  label = 'Bluetooth relay'
  private device: BluetoothDevice | null = null
  private rx: BluetoothRemoteGATTCharacteristic | null = null
  private tx: BluetoothRemoteGATTCharacteristic | null = null
  private readonly assembler = new ChunkAssembler()
  private seq = Math.floor(Math.random() * 0xffff)
  private queue: Promise<void> = Promise.resolve()
  private readonly packetBytes: number
  private manualStop = false

  constructor(private readonly options: BluetoothRelayOptions = {}) {
    super()
    this.id = `ble-${Math.random().toString(36).slice(2, 8)}`
    this.packetBytes = options.packetBytes ?? 180
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  async start() {
    if (!BluetoothRelayTransport.isSupported()) {
      this.setStatus('error', 'Web Bluetooth is not available in this browser')
      throw new Error('Web Bluetooth is not available in this browser')
    }
    this.manualStop = false
    this.setStatus('connecting')
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: this.options.namePrefix
          ? [{ services: [NUS_SERVICE] }, { namePrefix: this.options.namePrefix }]
          : [{ services: [NUS_SERVICE] }],
        optionalServices: [NUS_SERVICE],
      })
      this.label = `Relay · ${this.device.name ?? 'BLE node'}`
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect)
      await this.connect()
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  private async connect() {
    const server = await this.device!.gatt!.connect()
    const service = await server.getPrimaryService(NUS_SERVICE)
    this.rx = await service.getCharacteristic(NUS_RX)
    this.tx = await service.getCharacteristic(NUS_TX)
    this.tx.addEventListener('characteristicvaluechanged', this.handleNotify)
    await this.tx.startNotifications()
    this.setStatus('up')
  }

  private readonly handleNotify = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value
    if (!value) return
    const frame = this.assembler.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    if (frame) this.onFrame(frame)
  }

  private readonly handleDisconnect = () => {
    this.rx = null
    this.tx = null
    if (this.manualStop) {
      this.setStatus('down')
      return
    }
    this.setStatus('connecting', 'Reconnecting…')
    void this.reconnect(1)
  }

  private async reconnect(attempt: number) {
    if (this.manualStop || !this.device) return
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
    this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnect)
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.setStatus('down')
  }

  send(frame: string) {
    const rx = this.rx
    if (!rx) return
    this.seq = (this.seq + 1) & 0xffff
    const packets = chunkFrame(frame, this.seq, this.packetBytes)
    // GATT allows one operation at a time; serialise writes.
    this.queue = this.queue
      .then(async () => {
        for (const packet of packets) {
          if (rx.writeValueWithoutResponse) await rx.writeValueWithoutResponse(packet)
          else await rx.writeValue(packet)
        }
      })
      .catch((error) => this.setStatus('error', error instanceof Error ? error.message : String(error)))
  }
}
