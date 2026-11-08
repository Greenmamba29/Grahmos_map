import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/** Native phone-to-phone BLE link (plugins/grahmos-ble-mesh: Swift + Kotlin, dual role). */
export interface GrahmosBleMeshPlugin {
  start(): Promise<void>
  stop(): Promise<void>
  /** One packet, base64, sent to every linked phone. */
  send(options: { data: string }): Promise<void>
  status(): Promise<{ running: boolean; links: number }>
  addListener(event: 'packet', listener: (e: { data: string; from: string }) => void): Promise<PluginListenerHandle>
  addListener(event: 'peers', listener: (e: { links: number }) => void): Promise<PluginListenerHandle>
  addListener(event: 'error', listener: (e: { message: string }) => void): Promise<PluginListenerHandle>
}

export const GrahmosBleMesh = registerPlugin<GrahmosBleMeshPlugin>('GrahmosBleMesh')
